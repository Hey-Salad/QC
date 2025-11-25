var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// .wrangler/tmp/bundle-jEFwqU/checked-fetch.js
var urls = /* @__PURE__ */ new Set();
function checkURL(request, init) {
  const url = request instanceof URL ? request : new URL(
    (typeof request === "string" ? new Request(request, init) : request).url
  );
  if (url.port && url.port !== "443" && url.protocol === "https:") {
    if (!urls.has(url.toString())) {
      urls.add(url.toString());
      console.warn(
        `WARNING: known issue with \`fetch()\` requests to custom HTTPS ports in published Workers:
 - ${url.toString()} - the custom port will be ignored when the Worker is published using the \`wrangler deploy\` command.
`
      );
    }
  }
}
__name(checkURL, "checkURL");
globalThis.fetch = new Proxy(globalThis.fetch, {
  apply(target, thisArg, argArray) {
    const [request, init] = argArray;
    checkURL(request, init);
    return Reflect.apply(target, thisArg, argArray);
  }
});

// src/lib/station-repository.ts
function generateUUID() {
  return crypto.randomUUID();
}
__name(generateUUID, "generateUUID");
function getCurrentTimestamp() {
  return (/* @__PURE__ */ new Date()).toISOString();
}
__name(getCurrentTimestamp, "getCurrentTimestamp");
var StationRepository = class {
  static {
    __name(this, "StationRepository");
  }
  db;
  constructor(db) {
    this.db = db;
  }
  /**
   * List all stations
   * Requirements: 5.1
   */
  async list() {
    const result = await this.db.prepare("SELECT * FROM stations ORDER BY created_at DESC").all();
    return result.results || [];
  }
  /**
   * Get a station by ID
   * Requirements: 5.1
   */
  async getById(id) {
    const result = await this.db.prepare("SELECT * FROM stations WHERE id = ?").bind(id).first();
    return result || null;
  }
  /**
   * Create a new station
   * Requirements: 1.1, 5.2, 7.2
   */
  async create(input) {
    const id = generateUUID();
    const now = getCurrentTimestamp();
    const station = {
      id,
      name: input.name,
      type: input.type,
      location: input.location ?? null,
      description: input.description ?? null,
      qr_code_url: null,
      created_at: now,
      updated_at: now
    };
    await this.db.prepare(`
        INSERT INTO stations (id, name, type, location, description, qr_code_url, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
      station.id,
      station.name,
      station.type,
      station.location,
      station.description,
      station.qr_code_url,
      station.created_at,
      station.updated_at
    ).run();
    return station;
  }
  /**
   * Update an existing station
   * Requirements: 1.3, 5.3, 7.5
   */
  async update(id, input) {
    const existing = await this.getById(id);
    if (!existing) {
      return null;
    }
    const now = getCurrentTimestamp();
    const updates = [];
    const values = [];
    if (input.name !== void 0) {
      updates.push("name = ?");
      values.push(input.name);
    }
    if (input.type !== void 0) {
      updates.push("type = ?");
      values.push(input.type);
    }
    if (input.location !== void 0) {
      updates.push("location = ?");
      values.push(input.location ?? null);
    }
    if (input.description !== void 0) {
      updates.push("description = ?");
      values.push(input.description ?? null);
    }
    updates.push("updated_at = ?");
    values.push(now);
    values.push(id);
    await this.db.prepare(`UPDATE stations SET ${updates.join(", ")} WHERE id = ?`).bind(...values).run();
    return this.getById(id);
  }
  /**
   * Delete a station and associated detection rules
   * Requirements: 1.4, 5.4
   */
  async delete(id) {
    const existing = await this.getById(id);
    if (!existing) {
      return false;
    }
    await this.db.prepare("DELETE FROM stations WHERE id = ?").bind(id).run();
    return true;
  }
  /**
   * Check if a station exists
   */
  async exists(id) {
    const result = await this.db.prepare("SELECT 1 FROM stations WHERE id = ? LIMIT 1").bind(id).first();
    return result !== null;
  }
};

// src/lib/detection-log-repository.ts
var DEFAULT_LIMIT = 20;
var DetectionLogRepository = class {
  static {
    __name(this, "DetectionLogRepository");
  }
  db;
  constructor(db) {
    this.db = db;
  }
  /**
   * Get detection logs for a station with optional limit
   * Requirements: 3.5, 5.7
   * 
   * @param stationId - The station ID to filter by
   * @param limit - Maximum number of logs to return (default 20)
   * @returns Array of detection log entries, ordered by timestamp descending
   */
  async getByStationId(stationId, limit = DEFAULT_LIMIT) {
    const result = await this.db.prepare(`
        SELECT * FROM detection_logs 
        WHERE station_id = ? 
        ORDER BY timestamp DESC 
        LIMIT ?
      `).bind(stationId, limit).all();
    return (result.results || []).map((row) => this.parseDetectionLogRow(row));
  }
  /**
   * Get a single detection log by ID
   */
  async getById(id) {
    const result = await this.db.prepare("SELECT * FROM detection_logs WHERE id = ?").bind(id).first();
    if (!result) {
      return null;
    }
    return this.parseDetectionLogRow(result);
  }
  /**
   * Create a new detection log entry
   * Requirements: 3.5
   */
  async create(input) {
    const id = generateUUID();
    const now = getCurrentTimestamp();
    await this.db.prepare(`
        INSERT INTO detection_logs (id, station_id, detected_items, confidence_scores, pass_fail, image_url, timestamp)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).bind(
      id,
      input.station_id,
      JSON.stringify(input.detected_items),
      JSON.stringify(input.confidence_scores),
      input.pass_fail,
      input.image_url ?? null,
      now
    ).run();
    return {
      id,
      station_id: input.station_id,
      detected_items: input.detected_items,
      confidence_scores: input.confidence_scores,
      pass_fail: input.pass_fail,
      image_url: input.image_url ?? null,
      timestamp: now
    };
  }
  /**
   * Delete all detection logs for a station
   */
  async deleteByStationId(stationId) {
    const result = await this.db.prepare("DELETE FROM detection_logs WHERE station_id = ?").bind(stationId).run();
    return result.meta.changes ?? 0;
  }
  /**
   * Count detection logs for a station
   */
  async countByStationId(stationId) {
    const result = await this.db.prepare("SELECT COUNT(*) as count FROM detection_logs WHERE station_id = ?").bind(stationId).first();
    return result?.count ?? 0;
  }
  /**
   * Parse a database row into a DetectionLogEntry object
   */
  parseDetectionLogRow(row) {
    let detectedItems = [];
    let confidenceScores = {};
    try {
      detectedItems = JSON.parse(row.detected_items);
    } catch {
      detectedItems = [];
    }
    try {
      if (row.confidence_scores) {
        confidenceScores = JSON.parse(row.confidence_scores);
      }
    } catch {
      confidenceScores = {};
    }
    return {
      id: row.id,
      station_id: row.station_id,
      detected_items: detectedItems,
      confidence_scores: confidenceScores,
      pass_fail: row.pass_fail,
      image_url: row.image_url,
      timestamp: row.timestamp
    };
  }
};

// src/lib/detection-rules-repository.ts
var DEFAULT_ALERT_CONFIG = {
  enabled: false,
  triggers: []
};
var DEFAULT_CONFIDENCE_THRESHOLD = 0.75;
var DetectionRulesRepository = class {
  static {
    __name(this, "DetectionRulesRepository");
  }
  db;
  constructor(db) {
    this.db = db;
  }
  /**
   * Get detection rules for a station
   * Requirements: 5.8
   */
  async getByStationId(stationId) {
    const result = await this.db.prepare("SELECT * FROM detection_rules WHERE station_id = ?").bind(stationId).first();
    if (!result) {
      return null;
    }
    return this.parseDetectionRulesRow(result);
  }
  /**
   * Create detection rules for a station
   * Requirements: 4.6
   */
  async create(stationId, input) {
    const id = generateUUID();
    const now = getCurrentTimestamp();
    const expectedItems = input.expected_items;
    const confidenceThreshold = input.confidence_threshold ?? DEFAULT_CONFIDENCE_THRESHOLD;
    const alertConfig = input.alert_config ?? DEFAULT_ALERT_CONFIG;
    await this.db.prepare(`
        INSERT INTO detection_rules (id, station_id, expected_items, confidence_threshold, alert_config, created_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `).bind(
      id,
      stationId,
      JSON.stringify(expectedItems),
      confidenceThreshold,
      JSON.stringify(alertConfig),
      now
    ).run();
    return {
      id,
      station_id: stationId,
      expected_items: expectedItems,
      confidence_threshold: confidenceThreshold,
      alert_config: alertConfig,
      created_at: now
    };
  }
  /**
   * Update detection rules for a station (upsert)
   * Requirements: 5.8
   */
  async upsert(stationId, input) {
    const existing = await this.getByStationId(stationId);
    if (existing) {
      return this.update(stationId, input);
    } else {
      return this.create(stationId, input);
    }
  }
  /**
   * Update existing detection rules
   * Requirements: 5.8
   */
  async update(stationId, input) {
    const existing = await this.getByStationId(stationId);
    if (!existing) {
      throw new Error(`Detection rules not found for station ${stationId}`);
    }
    const expectedItems = input.expected_items;
    const confidenceThreshold = input.confidence_threshold ?? existing.confidence_threshold;
    const alertConfig = input.alert_config ?? existing.alert_config;
    await this.db.prepare(`
        UPDATE detection_rules 
        SET expected_items = ?, confidence_threshold = ?, alert_config = ?
        WHERE station_id = ?
      `).bind(
      JSON.stringify(expectedItems),
      confidenceThreshold,
      JSON.stringify(alertConfig),
      stationId
    ).run();
    return {
      ...existing,
      expected_items: expectedItems,
      confidence_threshold: confidenceThreshold,
      alert_config: alertConfig
    };
  }
  /**
   * Delete detection rules for a station
   */
  async delete(stationId) {
    const existing = await this.getByStationId(stationId);
    if (!existing) {
      return false;
    }
    await this.db.prepare("DELETE FROM detection_rules WHERE station_id = ?").bind(stationId).run();
    return true;
  }
  /**
   * Parse a database row into a DetectionRules object
   */
  parseDetectionRulesRow(row) {
    let expectedItems = [];
    let alertConfig = DEFAULT_ALERT_CONFIG;
    try {
      expectedItems = JSON.parse(row.expected_items);
    } catch {
      expectedItems = [];
    }
    try {
      if (row.alert_config) {
        alertConfig = JSON.parse(row.alert_config);
      }
    } catch {
      alertConfig = DEFAULT_ALERT_CONFIG;
    }
    return {
      id: row.id,
      station_id: row.station_id,
      expected_items: expectedItems,
      confidence_threshold: row.confidence_threshold,
      alert_config: alertConfig,
      created_at: row.created_at
    };
  }
};

// src/lib/validation.ts
var VALID_STATION_TYPES = ["packing", "prep", "storage", "receiving"];
var UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
var STATION_VALIDATION = {
  name: { minLength: 1, maxLength: 100 },
  location: { maxLength: 200 },
  description: { maxLength: 500 }
};
function isValidUUID(uuid) {
  if (typeof uuid !== "string") return false;
  return UUID_REGEX.test(uuid);
}
__name(isValidUUID, "isValidUUID");
function isValidStationType(type) {
  return typeof type === "string" && VALID_STATION_TYPES.includes(type);
}
__name(isValidStationType, "isValidStationType");
function validateStationName(name) {
  const errors = [];
  if (name === void 0 || name === null) {
    errors.push("Name is required");
  } else if (typeof name !== "string") {
    errors.push("Name must be a string");
  } else {
    const trimmed = name.trim();
    if (trimmed.length < STATION_VALIDATION.name.minLength) {
      errors.push(`Name must be at least ${STATION_VALIDATION.name.minLength} character(s)`);
    }
    if (trimmed.length > STATION_VALIDATION.name.maxLength) {
      errors.push(`Name must be at most ${STATION_VALIDATION.name.maxLength} characters`);
    }
  }
  return { valid: errors.length === 0, errors };
}
__name(validateStationName, "validateStationName");
function validateStationLocation(location) {
  const errors = [];
  if (location !== void 0 && location !== null) {
    if (typeof location !== "string") {
      errors.push("Location must be a string");
    } else if (location.length > STATION_VALIDATION.location.maxLength) {
      errors.push(`Location must be at most ${STATION_VALIDATION.location.maxLength} characters`);
    }
  }
  return { valid: errors.length === 0, errors };
}
__name(validateStationLocation, "validateStationLocation");
function validateStationDescription(description) {
  const errors = [];
  if (description !== void 0 && description !== null) {
    if (typeof description !== "string") {
      errors.push("Description must be a string");
    } else if (description.length > STATION_VALIDATION.description.maxLength) {
      errors.push(`Description must be at most ${STATION_VALIDATION.description.maxLength} characters`);
    }
  }
  return { valid: errors.length === 0, errors };
}
__name(validateStationDescription, "validateStationDescription");
function validateCreateStationInput(input) {
  const errors = [];
  if (!input || typeof input !== "object") {
    return { valid: false, errors: ["Input must be an object"] };
  }
  const data = input;
  const nameResult = validateStationName(data.name);
  errors.push(...nameResult.errors);
  if (data.type === void 0 || data.type === null) {
    errors.push("Type is required");
  } else if (!isValidStationType(data.type)) {
    errors.push(`Type must be one of: ${VALID_STATION_TYPES.join(", ")}`);
  }
  const locationResult = validateStationLocation(data.location);
  errors.push(...locationResult.errors);
  const descriptionResult = validateStationDescription(data.description);
  errors.push(...descriptionResult.errors);
  return { valid: errors.length === 0, errors };
}
__name(validateCreateStationInput, "validateCreateStationInput");
function validateUpdateStationInput(input) {
  const errors = [];
  if (!input || typeof input !== "object") {
    return { valid: false, errors: ["Input must be an object"] };
  }
  const data = input;
  if (data.name !== void 0) {
    const nameResult = validateStationName(data.name);
    errors.push(...nameResult.errors);
  }
  if (data.type !== void 0 && !isValidStationType(data.type)) {
    errors.push(`Type must be one of: ${VALID_STATION_TYPES.join(", ")}`);
  }
  const locationResult = validateStationLocation(data.location);
  errors.push(...locationResult.errors);
  const descriptionResult = validateStationDescription(data.description);
  errors.push(...descriptionResult.errors);
  return { valid: errors.length === 0, errors };
}
__name(validateUpdateStationInput, "validateUpdateStationInput");
function isValidConfidenceThreshold(threshold) {
  if (typeof threshold !== "number") return false;
  if (Number.isNaN(threshold)) return false;
  return threshold >= 0 && threshold <= 1;
}
__name(isValidConfidenceThreshold, "isValidConfidenceThreshold");
function validateConfidenceThreshold(threshold) {
  const errors = [];
  if (threshold === void 0 || threshold === null) {
    return { valid: true, errors: [] };
  }
  if (typeof threshold !== "number") {
    errors.push("Confidence threshold must be a number");
  } else if (Number.isNaN(threshold)) {
    errors.push("Confidence threshold cannot be NaN");
  } else if (threshold < 0) {
    errors.push("Confidence threshold must be at least 0.0");
  } else if (threshold > 1) {
    errors.push("Confidence threshold must be at most 1.0");
  }
  return { valid: errors.length === 0, errors };
}
__name(validateConfidenceThreshold, "validateConfidenceThreshold");
function validateExpectedItem(item) {
  const errors = [];
  if (!item || typeof item !== "object") {
    return { valid: false, errors: ["Expected item must be an object"] };
  }
  const data = item;
  if (data.label === void 0 || data.label === null) {
    errors.push("Expected item label is required");
  } else if (typeof data.label !== "string") {
    errors.push("Expected item label must be a string");
  } else if (data.label.trim().length === 0) {
    errors.push("Expected item label cannot be empty");
  }
  if (data.required === void 0 || data.required === null) {
    errors.push("Expected item required field is required");
  } else if (typeof data.required !== "boolean") {
    errors.push("Expected item required must be a boolean");
  }
  if (data.min_confidence !== void 0 && data.min_confidence !== null) {
    if (!isValidConfidenceThreshold(data.min_confidence)) {
      errors.push("Expected item min_confidence must be a number between 0.0 and 1.0");
    }
  }
  return { valid: errors.length === 0, errors };
}
__name(validateExpectedItem, "validateExpectedItem");
var VALID_ALERT_TRIGGERS = ["missing_item", "low_confidence", "all_failures"];
function validateAlertConfig(config) {
  const errors = [];
  if (config === void 0 || config === null) {
    return { valid: true, errors: [] };
  }
  if (typeof config !== "object") {
    return { valid: false, errors: ["Alert config must be an object"] };
  }
  const data = config;
  if (data.enabled === void 0 || data.enabled === null) {
    errors.push("Alert config enabled field is required");
  } else if (typeof data.enabled !== "boolean") {
    errors.push("Alert config enabled must be a boolean");
  }
  if (data.email !== void 0 && data.email !== null && typeof data.email !== "string") {
    errors.push("Alert config email must be a string");
  }
  if (data.slack_webhook !== void 0 && data.slack_webhook !== null && typeof data.slack_webhook !== "string") {
    errors.push("Alert config slack_webhook must be a string");
  }
  if (data.sms !== void 0 && data.sms !== null && typeof data.sms !== "string") {
    errors.push("Alert config sms must be a string");
  }
  if (data.triggers === void 0 || data.triggers === null) {
    errors.push("Alert config triggers is required");
  } else if (!Array.isArray(data.triggers)) {
    errors.push("Alert config triggers must be an array");
  } else {
    for (const trigger of data.triggers) {
      if (!VALID_ALERT_TRIGGERS.includes(trigger)) {
        errors.push(`Invalid alert trigger: ${trigger}. Must be one of: ${VALID_ALERT_TRIGGERS.join(", ")}`);
      }
    }
  }
  return { valid: errors.length === 0, errors };
}
__name(validateAlertConfig, "validateAlertConfig");
function validateDetectionRulesInput(input) {
  const errors = [];
  if (!input || typeof input !== "object") {
    return { valid: false, errors: ["Input must be an object"] };
  }
  const data = input;
  if (data.expected_items === void 0 || data.expected_items === null) {
    errors.push("Expected items is required");
  } else if (!Array.isArray(data.expected_items)) {
    errors.push("Expected items must be an array");
  } else {
    for (let i = 0; i < data.expected_items.length; i++) {
      const itemResult = validateExpectedItem(data.expected_items[i]);
      for (const error of itemResult.errors) {
        errors.push(`Expected item [${i}]: ${error}`);
      }
    }
  }
  const thresholdResult = validateConfidenceThreshold(data.confidence_threshold);
  errors.push(...thresholdResult.errors);
  const alertResult = validateAlertConfig(data.alert_config);
  errors.push(...alertResult.errors);
  return { valid: errors.length === 0, errors };
}
__name(validateDetectionRulesInput, "validateDetectionRulesInput");
function validateDetectionRequest(input) {
  const errors = [];
  if (!input || typeof input !== "object") {
    return { valid: false, errors: ["Input must be an object"] };
  }
  const data = input;
  if (data.station_id === void 0 || data.station_id === null) {
    errors.push("station_id is required");
  } else if (typeof data.station_id !== "string") {
    errors.push("station_id must be a string");
  } else if (data.station_id.trim().length === 0) {
    errors.push("station_id cannot be empty");
  }
  if (data.image_data === void 0 || data.image_data === null) {
    errors.push("image_data is required");
  } else if (typeof data.image_data !== "string") {
    errors.push("image_data must be a string");
  }
  return { valid: errors.length === 0, errors };
}
__name(validateDetectionRequest, "validateDetectionRequest");

// src/lib/checklist.ts
function compareChecklist(expectedItems, detectedObjects, confidenceThreshold = 0) {
  const detectedMap = /* @__PURE__ */ new Map();
  for (const obj of detectedObjects) {
    const normalizedLabel = obj.label.toLowerCase().trim();
    const existingConfidence = detectedMap.get(normalizedLabel) ?? 0;
    if (obj.confidence > existingConfidence) {
      detectedMap.set(normalizedLabel, obj.confidence);
    }
  }
  const items = [];
  const found = [];
  const missing = [];
  let allRequiredFound = true;
  for (const expected of expectedItems) {
    const normalizedLabel = expected.label.toLowerCase().trim();
    const detectedConfidence = detectedMap.get(normalizedLabel);
    const itemFound = detectedConfidence !== void 0 && detectedConfidence >= confidenceThreshold;
    items.push({
      label: expected.label,
      required: expected.required,
      found: itemFound,
      confidence: detectedConfidence ?? null
    });
    if (itemFound) {
      found.push(expected.label);
    } else {
      missing.push(expected.label);
      if (expected.required) {
        allRequiredFound = false;
      }
    }
  }
  return {
    items,
    found,
    missing,
    pass: allRequiredFound
  };
}
__name(compareChecklist, "compareChecklist");

// src/lib/mock-detection.ts
var MOCK_DETECTABLE_ITEMS = [
  "lettuce",
  "tomato",
  "cucumber",
  "onion",
  "carrot",
  "chicken",
  "beef",
  "tofu",
  "cheese",
  "dressing",
  "croutons",
  "bacon",
  "egg",
  "avocado",
  "pepper",
  "salt",
  "napkin",
  "fork",
  "knife",
  "container",
  "lid",
  "label"
];
function generateRandomBbox() {
  const x = Math.floor(Math.random() * 500);
  const y = Math.floor(Math.random() * 400);
  const width = Math.floor(Math.random() * 100) + 50;
  const height = Math.floor(Math.random() * 100) + 50;
  return [x, y, width, height];
}
__name(generateRandomBbox, "generateRandomBbox");
function generateRandomConfidence() {
  return 0.5 + Math.random() * 0.5;
}
__name(generateRandomConfidence, "generateRandomConfidence");
function generateMockDetectedObjects(expectedItems, detectionRate = 0.8) {
  const detected = [];
  for (const item of expectedItems) {
    if (Math.random() < detectionRate) {
      detected.push({
        label: item.label,
        confidence: generateRandomConfidence(),
        bbox: generateRandomBbox()
      });
    }
  }
  if (Math.random() < 0.3) {
    const randomItem = MOCK_DETECTABLE_ITEMS[Math.floor(Math.random() * MOCK_DETECTABLE_ITEMS.length)];
    const alreadyDetected = detected.some((d) => d.label.toLowerCase() === randomItem.toLowerCase());
    if (!alreadyDetected) {
      detected.push({
        label: randomItem,
        confidence: generateRandomConfidence(),
        bbox: generateRandomBbox()
      });
    }
  }
  return detected;
}
__name(generateMockDetectedObjects, "generateMockDetectedObjects");
function processMockDetection(expectedItems, confidenceThreshold = 0.75, detectionRate = 0.8) {
  const detectedObjects = generateMockDetectedObjects(expectedItems, detectionRate);
  const checklistResult = compareChecklist(expectedItems, detectedObjects, confidenceThreshold);
  return {
    detected_objects: detectedObjects,
    expected_objects: expectedItems.map((item) => item.label),
    timestamp: (/* @__PURE__ */ new Date()).toISOString(),
    pass: checklistResult.pass,
    missing: checklistResult.missing
  };
}
__name(processMockDetection, "processMockDetection");

// src/worker.ts
function corsHeaders(origin, allowedOrigins) {
  const origins = allowedOrigins.split(",").map((o) => o.trim());
  const allowOrigin = origins.includes(origin) ? origin : origins[0];
  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type"
  };
}
__name(corsHeaders, "corsHeaders");
function handleOptions(request, env) {
  const origin = request.headers.get("Origin") || "";
  return new Response(null, {
    status: 204,
    headers: corsHeaders(origin, env.ALLOWED_ORIGINS)
  });
}
__name(handleOptions, "handleOptions");
function jsonResponse(data, status = 200, origin = "", allowedOrigins = "") {
  const headers = {
    "Content-Type": "application/json",
    ...allowedOrigins ? corsHeaders(origin, allowedOrigins) : {}
  };
  return new Response(JSON.stringify(data), { status, headers });
}
__name(jsonResponse, "jsonResponse");
function errorResponse(message, status = 500, origin = "", allowedOrigins = "") {
  return jsonResponse({ error: message }, status, origin, allowedOrigins);
}
__name(errorResponse, "errorResponse");
function validationErrorResponse(errors, origin = "", allowedOrigins = "") {
  return jsonResponse({ error: "VALIDATION_ERROR", message: "Validation failed", errors }, 422, origin, allowedOrigins);
}
__name(validationErrorResponse, "validationErrorResponse");
var worker_default = {
  async fetch(request, env, _ctx) {
    const url = new URL(request.url);
    const origin = request.headers.get("Origin") || "";
    if (request.method === "OPTIONS") {
      return handleOptions(request, env);
    }
    const stationRepository = new StationRepository(env.DB);
    if (url.pathname.startsWith("/api/")) {
      try {
        if (url.pathname === "/api/health") {
          return jsonResponse({ status: "ok", timestamp: (/* @__PURE__ */ new Date()).toISOString() }, 200, origin, env.ALLOWED_ORIGINS);
        }
        if (url.pathname === "/api/stations" && request.method === "GET") {
          const stations = await stationRepository.list();
          return jsonResponse(stations, 200, origin, env.ALLOWED_ORIGINS);
        }
        if (url.pathname === "/api/stations" && request.method === "POST") {
          let body;
          try {
            body = await request.json();
          } catch {
            return errorResponse("Invalid JSON", 400, origin, env.ALLOWED_ORIGINS);
          }
          const validation = validateCreateStationInput(body);
          if (!validation.valid) {
            return validationErrorResponse(validation.errors, origin, env.ALLOWED_ORIGINS);
          }
          const station = await stationRepository.create(body);
          return jsonResponse(station, 201, origin, env.ALLOWED_ORIGINS);
        }
        const stationMatch = url.pathname.match(/^\/api\/stations\/([^/]+)$/);
        if (stationMatch) {
          const stationId = stationMatch[1];
          if (!isValidUUID(stationId)) {
            return errorResponse("Invalid station ID format", 400, origin, env.ALLOWED_ORIGINS);
          }
          if (request.method === "GET") {
            const station = await stationRepository.getById(stationId);
            if (!station) {
              return errorResponse("Station not found", 404, origin, env.ALLOWED_ORIGINS);
            }
            return jsonResponse(station, 200, origin, env.ALLOWED_ORIGINS);
          }
          if (request.method === "PUT") {
            let body;
            try {
              body = await request.json();
            } catch {
              return errorResponse("Invalid JSON", 400, origin, env.ALLOWED_ORIGINS);
            }
            const validation = validateUpdateStationInput(body);
            if (!validation.valid) {
              return validationErrorResponse(validation.errors, origin, env.ALLOWED_ORIGINS);
            }
            const station = await stationRepository.update(stationId, body);
            if (!station) {
              return errorResponse("Station not found", 404, origin, env.ALLOWED_ORIGINS);
            }
            return jsonResponse(station, 200, origin, env.ALLOWED_ORIGINS);
          }
          if (request.method === "DELETE") {
            const deleted = await stationRepository.delete(stationId);
            if (!deleted) {
              return errorResponse("Station not found", 404, origin, env.ALLOWED_ORIGINS);
            }
            return new Response(null, {
              status: 204,
              headers: corsHeaders(origin, env.ALLOWED_ORIGINS)
            });
          }
        }
        const logsMatch = url.pathname.match(/^\/api\/stations\/([^/]+)\/logs$/);
        if (logsMatch && request.method === "GET") {
          const stationId = logsMatch[1];
          if (!isValidUUID(stationId)) {
            return errorResponse("Invalid station ID format", 400, origin, env.ALLOWED_ORIGINS);
          }
          const station = await stationRepository.getById(stationId);
          if (!station) {
            return errorResponse("Station not found", 404, origin, env.ALLOWED_ORIGINS);
          }
          const limitParam = url.searchParams.get("limit");
          let limit = 20;
          if (limitParam) {
            const parsedLimit = parseInt(limitParam, 10);
            if (!isNaN(parsedLimit) && parsedLimit > 0) {
              limit = Math.min(parsedLimit, 100);
            }
          }
          const detectionLogRepository = new DetectionLogRepository(env.DB);
          const logs = await detectionLogRepository.getByStationId(stationId, limit);
          return jsonResponse(logs, 200, origin, env.ALLOWED_ORIGINS);
        }
        const rulesMatch = url.pathname.match(/^\/api\/stations\/([^/]+)\/rules$/);
        if (rulesMatch) {
          const stationId = rulesMatch[1];
          if (!isValidUUID(stationId)) {
            return errorResponse("Invalid station ID format", 400, origin, env.ALLOWED_ORIGINS);
          }
          const station = await stationRepository.getById(stationId);
          if (!station) {
            return errorResponse("Station not found", 404, origin, env.ALLOWED_ORIGINS);
          }
          const detectionRulesRepository = new DetectionRulesRepository(env.DB);
          if (request.method === "GET") {
            const rules = await detectionRulesRepository.getByStationId(stationId);
            return jsonResponse(rules, 200, origin, env.ALLOWED_ORIGINS);
          }
          if (request.method === "PUT") {
            let body;
            try {
              body = await request.json();
            } catch {
              return errorResponse("Invalid JSON", 400, origin, env.ALLOWED_ORIGINS);
            }
            const validation = validateDetectionRulesInput(body);
            if (!validation.valid) {
              return validationErrorResponse(validation.errors, origin, env.ALLOWED_ORIGINS);
            }
            const rules = await detectionRulesRepository.upsert(
              stationId,
              body
            );
            return jsonResponse(rules, 200, origin, env.ALLOWED_ORIGINS);
          }
        }
        if (url.pathname === "/api/detect" && request.method === "POST") {
          let body;
          try {
            body = await request.json();
          } catch {
            return errorResponse("Invalid JSON", 400, origin, env.ALLOWED_ORIGINS);
          }
          const validation = validateDetectionRequest(body);
          if (!validation.valid) {
            return validationErrorResponse(validation.errors, origin, env.ALLOWED_ORIGINS);
          }
          const { station_id: stationId } = body;
          if (!isValidUUID(stationId)) {
            return errorResponse("Invalid station ID format", 400, origin, env.ALLOWED_ORIGINS);
          }
          const station = await stationRepository.getById(stationId);
          if (!station) {
            return errorResponse("Station not found", 404, origin, env.ALLOWED_ORIGINS);
          }
          const detectionRulesRepository = new DetectionRulesRepository(env.DB);
          const rules = await detectionRulesRepository.getByStationId(stationId);
          const expectedItems = rules?.expected_items ?? [];
          const confidenceThreshold = rules?.confidence_threshold ?? 0.75;
          const detectionResult = processMockDetection(expectedItems, confidenceThreshold);
          const confidenceScores = {};
          for (const obj of detectionResult.detected_objects) {
            confidenceScores[obj.label] = obj.confidence;
          }
          const detectionLogRepository = new DetectionLogRepository(env.DB);
          await detectionLogRepository.create({
            station_id: stationId,
            detected_items: detectionResult.detected_objects,
            confidence_scores: confidenceScores,
            pass_fail: detectionResult.pass ? "pass" : "fail",
            image_url: null
            // Mock detection doesn't store images
          });
          return jsonResponse(detectionResult, 200, origin, env.ALLOWED_ORIGINS);
        }
        return errorResponse("Not Found", 404, origin, env.ALLOWED_ORIGINS);
      } catch (error) {
        console.error("API Error:", error);
        return errorResponse("Internal Server Error", 500, origin, env.ALLOWED_ORIGINS);
      }
    }
    return errorResponse("Not Found", 404, origin, env.ALLOWED_ORIGINS);
  }
};

// node_modules/wrangler/templates/middleware/middleware-ensure-req-body-drained.ts
var drainBody = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } finally {
    try {
      if (request.body !== null && !request.bodyUsed) {
        const reader = request.body.getReader();
        while (!(await reader.read()).done) {
        }
      }
    } catch (e) {
      console.error("Failed to drain the unused request body.", e);
    }
  }
}, "drainBody");
var middleware_ensure_req_body_drained_default = drainBody;

// node_modules/wrangler/templates/middleware/middleware-miniflare3-json-error.ts
function reduceError(e) {
  return {
    name: e?.name,
    message: e?.message ?? String(e),
    stack: e?.stack,
    cause: e?.cause === void 0 ? void 0 : reduceError(e.cause)
  };
}
__name(reduceError, "reduceError");
var jsonError = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } catch (e) {
    const error = reduceError(e);
    return Response.json(error, {
      status: 500,
      headers: { "MF-Experimental-Error-Stack": "true" }
    });
  }
}, "jsonError");
var middleware_miniflare3_json_error_default = jsonError;

// .wrangler/tmp/bundle-jEFwqU/middleware-insertion-facade.js
var __INTERNAL_WRANGLER_MIDDLEWARE__ = [
  middleware_ensure_req_body_drained_default,
  middleware_miniflare3_json_error_default
];
var middleware_insertion_facade_default = worker_default;

// node_modules/wrangler/templates/middleware/common.ts
var __facade_middleware__ = [];
function __facade_register__(...args) {
  __facade_middleware__.push(...args.flat());
}
__name(__facade_register__, "__facade_register__");
function __facade_invokeChain__(request, env, ctx, dispatch, middlewareChain) {
  const [head, ...tail] = middlewareChain;
  const middlewareCtx = {
    dispatch,
    next(newRequest, newEnv) {
      return __facade_invokeChain__(newRequest, newEnv, ctx, dispatch, tail);
    }
  };
  return head(request, env, ctx, middlewareCtx);
}
__name(__facade_invokeChain__, "__facade_invokeChain__");
function __facade_invoke__(request, env, ctx, dispatch, finalMiddleware) {
  return __facade_invokeChain__(request, env, ctx, dispatch, [
    ...__facade_middleware__,
    finalMiddleware
  ]);
}
__name(__facade_invoke__, "__facade_invoke__");

// .wrangler/tmp/bundle-jEFwqU/middleware-loader.entry.ts
var __Facade_ScheduledController__ = class ___Facade_ScheduledController__ {
  constructor(scheduledTime, cron, noRetry) {
    this.scheduledTime = scheduledTime;
    this.cron = cron;
    this.#noRetry = noRetry;
  }
  static {
    __name(this, "__Facade_ScheduledController__");
  }
  #noRetry;
  noRetry() {
    if (!(this instanceof ___Facade_ScheduledController__)) {
      throw new TypeError("Illegal invocation");
    }
    this.#noRetry();
  }
};
function wrapExportedHandler(worker) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return worker;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  const fetchDispatcher = /* @__PURE__ */ __name(function(request, env, ctx) {
    if (worker.fetch === void 0) {
      throw new Error("Handler does not export a fetch() function.");
    }
    return worker.fetch(request, env, ctx);
  }, "fetchDispatcher");
  return {
    ...worker,
    fetch(request, env, ctx) {
      const dispatcher = /* @__PURE__ */ __name(function(type, init) {
        if (type === "scheduled" && worker.scheduled !== void 0) {
          const controller = new __Facade_ScheduledController__(
            Date.now(),
            init.cron ?? "",
            () => {
            }
          );
          return worker.scheduled(controller, env, ctx);
        }
      }, "dispatcher");
      return __facade_invoke__(request, env, ctx, dispatcher, fetchDispatcher);
    }
  };
}
__name(wrapExportedHandler, "wrapExportedHandler");
function wrapWorkerEntrypoint(klass) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return klass;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  return class extends klass {
    #fetchDispatcher = /* @__PURE__ */ __name((request, env, ctx) => {
      this.env = env;
      this.ctx = ctx;
      if (super.fetch === void 0) {
        throw new Error("Entrypoint class does not define a fetch() function.");
      }
      return super.fetch(request);
    }, "#fetchDispatcher");
    #dispatcher = /* @__PURE__ */ __name((type, init) => {
      if (type === "scheduled" && super.scheduled !== void 0) {
        const controller = new __Facade_ScheduledController__(
          Date.now(),
          init.cron ?? "",
          () => {
          }
        );
        return super.scheduled(controller);
      }
    }, "#dispatcher");
    fetch(request) {
      return __facade_invoke__(
        request,
        this.env,
        this.ctx,
        this.#dispatcher,
        this.#fetchDispatcher
      );
    }
  };
}
__name(wrapWorkerEntrypoint, "wrapWorkerEntrypoint");
var WRAPPED_ENTRY;
if (typeof middleware_insertion_facade_default === "object") {
  WRAPPED_ENTRY = wrapExportedHandler(middleware_insertion_facade_default);
} else if (typeof middleware_insertion_facade_default === "function") {
  WRAPPED_ENTRY = wrapWorkerEntrypoint(middleware_insertion_facade_default);
}
var middleware_loader_entry_default = WRAPPED_ENTRY;
export {
  __INTERNAL_WRANGLER_MIDDLEWARE__,
  middleware_loader_entry_default as default
};
//# sourceMappingURL=worker.js.map
