import { z } from "zod";
import { getRequestId, json, handleError, parseJsonBody, RequestError, requireDb } from "../_utils.js";

const orderSchema = z.object({
  order_id: z.string().min(1),
  customerName: z.string().min(1),
  phone: z.string().min(3),
  address: z.string().optional().nullable(),
  deliveryZoneId: z.coerce.number().int().positive().optional().nullable(),
  postalCode: z.string().min(3).optional().nullable(),
  geo: z
    .object({
      lat: z.coerce.number().min(-90).max(90),
      lng: z.coerce.number().min(-180).max(180),
    })
    .optional()
    .nullable(),
  comment: z.string().optional().nullable(),
  payment_id: z.string().min(1).optional().nullable(),
  payment_status: z.string().min(1).optional().nullable(),
  payment_method: z.string().min(1).optional().nullable(),
  items: z.array(
    z.object({
      id: z.number().int().positive(),
      title: z.string().min(1),
      qty: z.number().int().positive(),
      price: z.number().nonnegative(),
    })
  ),
  total: z.number().nonnegative(),
});

const normalizeMoney = (value) => Math.round(value * 100) / 100;
const normalizeText = (value) => (value ? String(value).trim().toLowerCase() : "");
const normalizePostalCode = (value) => normalizeText(value).replace(/\s+/g, "");

const toRadians = (value) => (value * Math.PI) / 180;
const distanceMeters = (a, b) => {
  const earthRadius = 6371000;
  const dLat = toRadians(b.lat - a.lat);
  const dLng = toRadians(b.lng - a.lng);
  const lat1 = toRadians(a.lat);
  const lat2 = toRadians(b.lat);
  const sinLat = Math.sin(dLat / 2);
  const sinLng = Math.sin(dLng / 2);
  const h =
    sinLat * sinLat +
    Math.cos(lat1) * Math.cos(lat2) * sinLng * sinLng;
  return 2 * earthRadius * Math.asin(Math.min(1, Math.sqrt(h)));
};

const isPointInPolygon = (point, polygon) => {
  if (!Array.isArray(polygon) || polygon.length < 3) return false;
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].lng;
    const yi = polygon[i].lat;
    const xj = polygon[j].lng;
    const yj = polygon[j].lat;
    const intersects =
      (yi > point.lat) !== (yj > point.lat) &&
      point.lng < ((xj - xi) * (point.lat - yi)) / (yj - yi) + xi;
    if (intersects) inside = !inside;
  }
  return inside;
};

const parseGeoJson = (value) => {
  if (!value) return null;
  try {
    return JSON.parse(value);
  } catch (err) {
    return null;
  }
};

const matchGeoRule = (rule, point) => {
  if (!rule || !point) return false;
  if (rule.type === "circle") {
    const center = rule.center
      ? { lat: Number(rule.center.lat), lng: Number(rule.center.lng) }
      : null;
    const radiusMeters = Number(rule.radiusMeters);
    if (!center || Number.isNaN(radiusMeters)) return false;
    if (!Number.isFinite(center.lat) || !Number.isFinite(center.lng)) return false;
    return distanceMeters(point, center) <= radiusMeters;
  }
  if (rule.type === "polygon") {
    const points = Array.isArray(rule.points)
      ? rule.points
          .map((item) => {
            if (Array.isArray(item) && item.length >= 2) {
              return { lat: Number(item[0]), lng: Number(item[1]) };
            }
            if (item && typeof item === "object") {
              return { lat: Number(item.lat), lng: Number(item.lng) };
            }
            return null;
          })
          .filter((item) => item && Number.isFinite(item.lat) && Number.isFinite(item.lng))
      : [];
    return isPointInPolygon(point, points);
  }
  return false;
};

const matchZone = (zone, context) => {
  const matchType = normalizeText(zone.match_type);
  if (matchType === "address") {
    if (!context.address) return false;
    const token = normalizeText(zone.match_value);
    return token ? context.address.includes(token) : false;
  }
  if (matchType === "postal") {
    if (!context.postalCode) return false;
    const values = String(zone.match_value || "")
      .split(/[\n,;]+/)
      .map((value) => normalizePostalCode(value))
      .filter(Boolean);
    return values.some((value) => context.postalCode.startsWith(value));
  }
  if (matchType === "geo") {
    const geoRule = parseGeoJson(zone.geo_json || zone.match_value);
    return matchGeoRule(geoRule, context.geo);
  }
  return false;
};

const findMatchingZone = (zones, context) => {
  if (context.zoneId) {
    const zone = zones.find((item) => item.id === context.zoneId);
    if (!zone) return null;
    const hasContextData = !!context.address || !!context.postalCode || !!context.geo;
    if (!zone.match_type || !hasContextData) return zone;
    return matchZone(zone, context) ? zone : null;
  }
  return zones.find((zone) => matchZone(zone, context)) || null;
};

const loadDeliveryZones = async (db) => {
  try {
    const result = await db
      .prepare(
        `SELECT id, name, match_type, match_value, geo_json, priority
         FROM delivery_zones
         WHERE is_active = 1
         ORDER BY priority DESC, id ASC`
      )
      .all();
    return result.results || [];
  } catch (err) {
    if (String(err?.message || "").includes("no such table: delivery_zones")) {
      return [];
    }
    throw err;
  }
};

export async function onRequestPost({ env, request }) {
  const requestId = getRequestId(request);
  let orderId = null;
  const logEvent = (level, details = {}) => {
    const payload = {
      level,
      request_id: requestId,
      order_id: orderId,
      ...details,
    };
    console.log(JSON.stringify(payload));
  };

  try {
    const db = requireDb(env);
    const body = await parseJsonBody(request, orderSchema);
    orderId = body.order_id;

    if (!body.items.length) {
      throw new RequestError(400, "Items are required");
    }

    const productIds = [...new Set(body.items.map((item) => item.id))];
    const placeholders = productIds.map(() => "?").join(", ");
    const productsResult = await db
      .prepare(
        `SELECT id, title, price FROM products WHERE is_active = 1 AND id IN (${placeholders})`
      )
      .bind(...productIds)
      .all();
    const products = productsResult.results || [];
    const productMap = new Map(products.map((product) => [product.id, product]));
    const missingIds = productIds.filter((id) => !productMap.has(id));

    if (missingIds.length) {
      throw new RequestError(400, "Some products are missing or inactive", { missingIds });
    }

    const normalizedItems = body.items.map((item) => {
      const product = productMap.get(item.id);
      return {
        id: product.id,
        title: product.title,
        qty: item.qty,
        unit_price: product.price,
      };
    });

    const computedTotal = normalizeMoney(
      normalizedItems.reduce((sum, item) => sum + item.qty * item.unit_price, 0)
    );
    const clientTotal = normalizeMoney(body.total);

    if (Math.abs(clientTotal - computedTotal) > 0.01) {
      throw new RequestError(400, "Total mismatch", { expectedTotal: computedTotal });
    }

    const deliveryZones = await loadDeliveryZones(db);
    const deliveryContext = {
      address: normalizeText(body.address),
      postalCode: normalizePostalCode(body.postalCode),
      geo: body.geo ? { lat: body.geo.lat, lng: body.geo.lng } : null,
      zoneId: body.deliveryZoneId ? Number(body.deliveryZoneId) : null,
    };
    const hasDeliveryInfo =
      !!deliveryContext.address || !!deliveryContext.postalCode || !!deliveryContext.geo || !!deliveryContext.zoneId;
    if (deliveryZones.length && hasDeliveryInfo) {
      const matchedZone = findMatchingZone(deliveryZones, deliveryContext);
      if (!matchedZone) {
        throw new RequestError(400, "Адрес вне зоны доставки", {
          reason: "delivery_zone_mismatch",
        });
      }
    }

    const existingOrder = await db
      .prepare("SELECT id, status FROM orders WHERE order_id = ?")
      .bind(body.order_id)
      .first();

    if (existingOrder) {
      if (body.payment_id || body.payment_status || body.payment_method) {
        await db
          .prepare(
            `UPDATE orders
             SET payment_id = COALESCE(?, payment_id),
                 payment_status = COALESCE(?, payment_status),
                 payment_method = COALESCE(?, payment_method),
                 request_id = ?,
                 updated_at = datetime('now')
             WHERE order_id = ?`
          )
          .bind(
            body.payment_id || null,
            body.payment_status || null,
            body.payment_method || null,
            requestId,
            body.order_id
          )
          .run();
      } else {
        await db
          .prepare("UPDATE orders SET request_id = COALESCE(request_id, ?) WHERE order_id = ?")
          .bind(requestId, body.order_id)
          .run();
      }
      logEvent("info", { message: "order_exists", status: existingOrder.status });
      return json(
        { id: existingOrder.id, status: existingOrder.status, order_id: body.order_id },
        200,
        { "x-request-id": requestId }
      );
    }

    try {
      const result = await db
        .prepare(
          `INSERT INTO orders (order_id, request_id, created_at, updated_at, status, customer_name, phone, address, comment, items_json, total, payment_id, payment_status, payment_method)
           VALUES (?, ?, datetime('now'), datetime('now'), 'new', ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .bind(
          body.order_id,
          requestId,
          body.customerName,
          body.phone,
          body.address || null,
          body.comment || null,
          JSON.stringify(normalizedItems),
          computedTotal,
          body.payment_id || null,
          body.payment_status || null,
          body.payment_method || null
        )
        .run();

      logEvent("info", { message: "order_created", status: "new" });
      return json(
        { id: result.meta.last_row_id, status: "new", order_id: body.order_id },
        201,
        { "x-request-id": requestId }
      );
    } catch (insertError) {
      if (String(insertError?.message || "").includes("UNIQUE")) {
        const conflictOrder = await db
          .prepare("SELECT id, status FROM orders WHERE order_id = ?")
          .bind(body.order_id)
          .first();
        if (conflictOrder) {
          logEvent("info", { message: "order_conflict", status: conflictOrder.status });
          return json(
            { id: conflictOrder.id, status: conflictOrder.status, order_id: body.order_id },
            200,
            { "x-request-id": requestId }
          );
        }
      }
      throw insertError;
    }
  } catch (err) {
    logEvent("error", { message: "order_failed", error: String(err?.message || err) });
    return handleError(err, requestId);
  }
}
