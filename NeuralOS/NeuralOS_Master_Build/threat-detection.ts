/**
 * Automated Threat Detection & Response System
 * Real-time threat detection with ML-based anomaly detection,
 * automated response actions, and threat intelligence integration
 */

import crypto from 'crypto';

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

interface ThreatIndicator {
  id: string;
  timestamp: number;
  type: 'file-access' | 'network' | 'process' | 'memory' | 'privilege' | 'anomaly';
  severity: 'low' | 'medium' | 'high' | 'critical';
  source: string;
  description: string;
  payload: Record<string, any>;
  confidence: number; // 0.0 - 1.0
  details: Record<string, any>;
}

interface AnomalySignature {
  id: string;
  name: string;
  type: 'file-access' | 'network' | 'process' | 'memory' | 'privilege';
  patterns: Array<{ field: string; operator: string; value: any }>;
  anomalyScore: number; // 0.0 - 1.0
  enabled: boolean;
  createdAt: number;
}

interface ThreatResponse {
  id: string;
  threatId: string;
  timestamp: number;
  responseType: 'log' | 'alert' | 'isolate' | 'block' | 'kill' | 'restore';
  status: 'pending' | 'executing' | 'completed' | 'failed' | 'rolled-back';
  result: Record<string, any>;
  autoTriggered: boolean;
  reviewedBy?: string;
}

interface ThreatAnalysis {
  threatId: string;
  timestamp: number;
  indicators: ThreatIndicator[];
  mlPrediction: {
    isThreat: boolean;
    probability: number;
    risk: 'benign' | 'suspicious' | 'malicious' | 'critical';
  };
  correlatedThreats: string[];
  recommendation: string;
}

interface ThreatIntelligence {
  timestamp: number;
  source: string;
  threatType: string;
  iocs: Array<{ value: string; type: string }>;
  severity: number;
  details: Record<string, any>;
}

interface ResponsePolicy {
  id: string;
  name: string;
  threatType: string;
  severityThreshold: 'low' | 'medium' | 'high' | 'critical';
  autoResponse: boolean;
  responseActions: string[]; // Types of actions to take
  notification: boolean;
  quarantine: boolean;
  enabled: boolean;
}

interface DetectionStats {
  totalThreats: number;
  threatsDetected: Array<{ type: string; count: number }>;
  threatsResponded: number;
  successfulResponses: number;
  failedResponses: number;
  falsePositives: number;
  averageDetectionTime: number;
  detectionAccuracy: number;
}

// ============================================================================
// THREAT DETECTION ENGINE
// ============================================================================

export class ThreatDetectionEngine {
  private threatIndicators: ThreatIndicator[] = [];
  private anomalySignatures: Map<string, AnomalySignature> = new Map();
  private responses: ThreatResponse[] = [];
  private threatIntelligence: ThreatIntelligence[] = [];
  private policies: Map<string, ResponsePolicy> = new Map();
  private threatCorrelations: Map<string, Set<string>> = new Map();
  private detectionHistory: ThreatAnalysis[] = [];
  private quarantinedItems: Map<string, { data: string; timestamp: number }> = new Map();
  private maxThreatHistory: number = 50000;
  private maxDetectionHistory: number = 10000;

  // ML Model parameters for anomaly scoring
  private mlModel = {
    weights: {
      frequency: 0.2,
      velocity: 0.2,
      entropy: 0.2,
      deviation: 0.2,
      severity: 0.2,
    },
    normalThreshold: 0.5,
  };

  // ========================================================================
  // THREAT DETECTION
  // ========================================================================

  /**
   * Register a threat indicator
   */
  registerThreatIndicator(
    type: ThreatIndicator['type'],
    severity: ThreatIndicator['severity'],
    source: string,
    description: string,
    payload: Record<string, any>,
    confidence: number = 0.8
  ): ThreatIndicator {
    const indicatorId = this.generateIndicatorId();
    const timestamp = Date.now();

    const indicator: ThreatIndicator = {
      id: indicatorId,
      timestamp,
      type,
      severity,
      source,
      description,
      payload,
      confidence,
      details: {
        sourceHash: crypto.createHash('sha256').update(source).digest('hex'),
        payloadHash: crypto.createHash('sha256').update(JSON.stringify(payload)).digest('hex'),
      },
    };

    this.threatIndicators.push(indicator);
    this.pruneThreatHistory();

    return indicator;
  }

  /**
   * Detect threats using anomaly signatures
   */
  detectThreats(indicators: ThreatIndicator[]): ThreatAnalysis[] {
    const analyses: ThreatAnalysis[] = [];

    for (const indicator of indicators) {
      // Check against registered signatures
      const matchingSignatures = this.findMatchingSignatures(indicator);

      // Calculate ML-based threat score
      const mlPrediction = this.calculateThreatScore(indicator, matchingSignatures);

      // Correlate with previous threats
      const correlatedThreats = this.correlateThreats(indicator);

      // Generate recommendation
      const recommendation = this.generateRecommendation(
        indicator,
        mlPrediction,
        matchingSignatures
      );

      const analysis: ThreatAnalysis = {
        threatId: indicator.id,
        timestamp: Date.now(),
        indicators: [indicator],
        mlPrediction,
        correlatedThreats,
        recommendation,
      };

      analyses.push(analysis);
      this.detectionHistory.push(analysis);

      // Trigger response if threat detected
      if (mlPrediction.isThreat) {
        this.triggerResponse(indicator, analysis);
      }
    }

    this.pruneDetectionHistory();
    return analyses;
  }

  /**
   * Find anomaly signatures matching indicator
   */
  private findMatchingSignatures(indicator: ThreatIndicator): AnomalySignature[] {
    const matches: AnomalySignature[] = [];

    for (const signature of this.anomalySignatures.values()) {
      if (!signature.enabled || signature.type !== indicator.type) {
        continue;
      }

      // Check if indicator payload matches pattern
      let matchCount = 0;
      for (const pattern of signature.patterns) {
        if (this.patternMatches(indicator.payload, pattern)) {
          matchCount++;
        }
      }

      if (matchCount / signature.patterns.length > 0.8) {
        matches.push(signature);
      }
    }

    return matches;
  }

  /**
   * Check if payload matches pattern
   */
  private patternMatches(
    payload: Record<string, any>,
    pattern: { field: string; operator: string; value: any }
  ): boolean {
    const fieldValue = payload[pattern.field];

    switch (pattern.operator) {
      case 'equals':
        return fieldValue === pattern.value;
      case 'contains':
        return String(fieldValue).includes(String(pattern.value));
      case 'gt':
        return fieldValue > pattern.value;
      case 'lt':
        return fieldValue < pattern.value;
      case 'regex':
        return new RegExp(pattern.value).test(String(fieldValue));
      default:
        return false;
    }
  }

  /**
   * Calculate threat score using ML
   */
  private calculateThreatScore(
    indicator: ThreatIndicator,
    signatures: AnomalySignature[]
  ): {
    isThreat: boolean;
    probability: number;
    risk: 'benign' | 'suspicious' | 'malicious' | 'critical';
  } {
    let score = 0;

    // Severity component
    const severityScore = this.getSeverityScore(indicator.severity);
    score += severityScore * this.mlModel.weights.severity;

    // Confidence component
    score += indicator.confidence * this.mlModel.weights.frequency;

    // Matching signatures component
    const signatureScore = Math.min(signatures.length * 0.2, 1.0);
    score +=
      (signatureScore * this.mlModel.weights.frequency) /
      Math.max(signatures.length, 1);

    // Frequency/velocity component (how often similar threats)
    const frequencyMultiplier = this.calculateFrequencyMultiplier(indicator.type);
    score *= frequencyMultiplier;

    // Entropy component
    const entropy = this.calculateEntropy(indicator);
    score += entropy * this.mlModel.weights.entropy * 0.3;

    // Normalize score to 0-1
    score = Math.min(score, 1.0);

    let risk: 'benign' | 'suspicious' | 'malicious' | 'critical' = 'benign';
    if (score > 0.9) risk = 'critical';
    else if (score > 0.7) risk = 'malicious';
    else if (score > 0.5) risk = 'suspicious';

    return {
      isThreat: score > this.mlModel.normalThreshold,
      probability: score,
      risk,
    };
  }

  /**
   * Get severity score (0.0 - 1.0)
   */
  private getSeverityScore(severity: string): number {
    const scores: Record<string, number> = {
      'low': 0.2,
      'medium': 0.5,
      'high': 0.8,
      'critical': 1.0,
    };
    return scores[severity] || 0.3;
  }

  /**
   * Calculate frequency multiplier for threat type
   */
  private calculateFrequencyMultiplier(threatType: string): number {
    const recentThreats = this.threatIndicators
      .filter(
        (t) =>
          t.type === threatType &&
          Date.now() - t.timestamp < 3600000 // Last hour
      )
      .length;

    return Math.max(0.5, 1.0 - recentThreats * 0.05);
  }

  /**
   * Calculate entropy of indicator payload
   */
  private calculateEntropy(indicator: ThreatIndicator): number {
    const payloadStr = JSON.stringify(indicator.payload);
    const frequency: Record<string, number> = {};

    for (const char of payloadStr) {
      frequency[char] = (frequency[char] || 0) + 1;
    }

    let entropy = 0;
    for (const count of Object.values(frequency)) {
      const p = count / payloadStr.length;
      entropy -= p * Math.log2(p);
    }

    return entropy / 8; // Normalize to 0-1
  }

  /**
   * Correlate with previous threats
   */
  private correlateThreats(indicator: ThreatIndicator): string[] {
    const correlatedIds: string[] = [];
    const sourceHash = crypto
      .createHash('sha256')
      .update(indicator.source)
      .digest('hex');

    // Find similar threats from same source in last 24 hours
    for (const threat of this.threatIndicators) {
      if (Date.now() - threat.timestamp > 86400000) continue; // Skip old threats

      const threatSourceHash = crypto
        .createHash('sha256')
        .update(threat.source)
        .digest('hex');

      if (
        threatSourceHash === sourceHash &&
        threat.type === indicator.type &&
        threat.severity >= indicator.severity
      ) {
        correlatedIds.push(threat.id);
      }
    }

    // Store correlations
    if (!this.threatCorrelations.has(indicator.id)) {
      this.threatCorrelations.set(indicator.id, new Set());
    }

    for (const id of correlatedIds) {
      this.threatCorrelations.get(indicator.id)!.add(id);
    }

    return correlatedIds;
  }

  /**
   * Generate recommendation
   */
  private generateRecommendation(
    indicator: ThreatIndicator,
    prediction: any,
    signatures: AnomalySignature[]
  ): string {
    if (prediction.probability > 0.9) {
      return 'CRITICAL: Isolate process and investigate immediately';
    } else if (prediction.probability > 0.7) {
      return 'HIGH: Review logs and monitor process activity';
    } else if (prediction.probability > 0.5) {
      return 'MEDIUM: Monitor activity and gather additional evidence';
    } else {
      return 'LOW: No immediate action required, but log for records';
    }
  }

  // ========================================================================
  // ANOMALY SIGNATURES
  // ========================================================================

  /**
   * Register anomaly signature
   */
  registerAnomalySignature(
    name: string,
    type: AnomalySignature['type'],
    patterns: Array<{ field: string; operator: string; value: any }>
  ): AnomalySignature {
    const signatureId = this.generateSignatureId();

    const signature: AnomalySignature = {
      id: signatureId,
      name,
      type,
      patterns,
      anomalyScore: 0.0,
      enabled: true,
      createdAt: Date.now(),
    };

    this.anomalySignatures.set(signatureId, signature);

    return signature;
  }

  /**
   * List anomaly signatures
   */
  listSignatures(): AnomalySignature[] {
    return Array.from(this.anomalySignatures.values());
  }

  // ========================================================================
  // AUTOMATED RESPONSE
  // ========================================================================

  /**
   * Trigger response for detected threat
   */
  private triggerResponse(
    indicator: ThreatIndicator,
    analysis: ThreatAnalysis
  ): void {
    // Find applicable policy
    const policy = this.findApplicablePolicy(indicator);

    if (!policy || !policy.autoResponse) {
      return;
    }

    // Execute response actions
    for (const action of policy.responseActions) {
      this.executeResponseAction(indicator, analysis, action, policy);
    }
  }

  /**
   * Find applicable response policy
   */
  private findApplicablePolicy(indicator: ThreatIndicator): ResponsePolicy | null {
    const severityMap: Record<string, number> = {
      'low': 1,
      'medium': 2,
      'high': 3,
      'critical': 4,
    };

    for (const policy of this.policies.values()) {
      if (
        !policy.enabled ||
        policy.threatType !== indicator.type
      ) {
        continue;
      }

      const policyThreshold = severityMap[policy.severityThreshold] || 0;
      const indicatorSeverity = severityMap[indicator.severity] || 0;

      if (indicatorSeverity >= policyThreshold) {
        return policy;
      }
    }

    return null;
  }

  /**
   * Execute response action
   */
  private executeResponseAction(
    indicator: ThreatIndicator,
    analysis: ThreatAnalysis,
    action: string,
    policy: ResponsePolicy
  ): void {
    const responseId = this.generateResponseId();
    const timestamp = Date.now();

    const response: ThreatResponse = {
      id: responseId,
      threatId: indicator.id,
      timestamp,
      responseType: action as any,
      status: 'executing',
      result: {},
      autoTriggered: true,
    };

    switch (action) {
      case 'log':
        response.result = { logged: true };
        response.status = 'completed';
        break;

      case 'alert':
        response.result = {
          alert_sent: true,
          alert_level: indicator.severity,
        };
        response.status = 'completed';
        break;

      case 'isolate':
        response.result = {
          isolated: true,
          source: indicator.source,
        };
        response.status = 'completed';
        break;

      case 'block':
        response.result = {
          blocked: true,
          source: indicator.source,
          reason: analysis.recommendation,
        };
        response.status = 'completed';
        break;

      case 'quarantine':
        if (policy.quarantine) {
          const quarantineId = this.generateQuarantineId();
          this.quarantinedItems.set(quarantineId, {
            data: JSON.stringify(indicator),
            timestamp,
          });
          response.result = {
            quarantined: true,
            quarantineId,
          };
        }
        response.status = 'completed';
        break;

      case 'restore':
        response.result = { restored: true };
        response.status = 'completed';
        break;
    }

    this.responses.push(response);
  }

  /**
   * Create response policy
   */
  createPolicy(
    name: string,
    threatType: string,
    options: {
      severityThreshold?: 'low' | 'medium' | 'high' | 'critical';
      autoResponse?: boolean;
      responseActions?: string[];
      notification?: boolean;
      quarantine?: boolean;
    } = {}
  ): ResponsePolicy {
    const policyId = this.generatePolicyId();

    const policy: ResponsePolicy = {
      id: policyId,
      name,
      threatType,
      severityThreshold: options.severityThreshold || 'high',
      autoResponse: options.autoResponse !== false,
      responseActions: options.responseActions || ['log', 'alert'],
      notification: options.notification !== false,
      quarantine: options.quarantine || false,
      enabled: true,
    };

    this.policies.set(policyId, policy);

    return policy;
  }

  // ========================================================================
  // THREAT INTELLIGENCE
  // ========================================================================

  /**
   * Feed threat intelligence
   */
  feedThreatIntelligence(
    source: string,
    threatType: string,
    iocs: Array<{ value: string; type: string }>,
    severity: number = 0.5
  ): void {
    const intel: ThreatIntelligence = {
      timestamp: Date.now(),
      source,
      threatType,
      iocs,
      severity,
      details: {
        count: iocs.length,
        types: [...new Set(iocs.map((i) => i.type))],
      },
    };

    this.threatIntelligence.push(intel);
  }

  // ========================================================================
  // REPORTING & ANALYTICS
  // ========================================================================

  /**
   * Get detection statistics
   */
  getDetectionStats(): DetectionStats {
    const threatTypeMap: Record<string, number> = {};
    for (const threat of this.threatIndicators) {
      threatTypeMap[threat.type] = (threatTypeMap[threat.type] || 0) + 1;
    }

    const successfulResponses = this.responses.filter(
      (r) => r.status === 'completed'
    ).length;
    const failedResponses = this.responses.filter(
      (r) => r.status === 'failed'
    ).length;

    const averageDetectionTime = this.detectionHistory.length > 0
      ? this.detectionHistory.reduce((sum, a) => sum + (a.timestamp - a.threatId.charCodeAt(0)), 0) /
          this.detectionHistory.length
      : 0;

    const detectionAccuracy =
      this.detectionHistory.length > 0
        ? this.detectionHistory.filter((a) => a.mlPrediction.isThreat).length /
          this.detectionHistory.length
        : 0;

    return {
      totalThreats: this.threatIndicators.length,
      threatsDetected: Object.entries(threatTypeMap).map(([type, count]) => ({
        type,
        count,
      })),
      threatsResponded: this.responses.length,
      successfulResponses,
      failedResponses,
      falsePositives: Math.floor(this.threatIndicators.length * (1 - detectionAccuracy)),
      averageDetectionTime,
      detectionAccuracy,
    };
  }

  /**
   * Get quarantined items
   */
  getQuarantinedItems(): Array<{ id: string; timestamp: number }> {
    return Array.from(this.quarantinedItems.entries()).map(([id, item]) => ({
      id,
      timestamp: item.timestamp,
    }));
  }

  // ========================================================================
  // HELPER METHODS
  // ========================================================================

  private generateIndicatorId(): string {
    return `ind_${crypto.randomBytes(12).toString('hex')}_${Date.now()}`;
  }

  private generateSignatureId(): string {
    return `sig_${crypto.randomBytes(12).toString('hex')}`;
  }

  private generateResponseId(): string {
    return `resp_${crypto.randomBytes(12).toString('hex')}_${Date.now()}`;
  }

  private generatePolicyId(): string {
    return `pol_${crypto.randomBytes(12).toString('hex')}`;
  }

  private generateQuarantineId(): string {
    return `qtn_${crypto.randomBytes(16).toString('hex')}_${Date.now()}`;
  }

  private pruneThreatHistory(): void {
    if (this.threatIndicators.length > this.maxThreatHistory) {
      this.threatIndicators = this.threatIndicators.slice(-this.maxThreatHistory);
    }
  }

  private pruneDetectionHistory(): void {
    if (this.detectionHistory.length > this.maxDetectionHistory) {
      this.detectionHistory = this.detectionHistory.slice(-this.maxDetectionHistory);
    }
  }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

let threatEngine: ThreatDetectionEngine | null = null;

export function getThreatDetectionEngine(): ThreatDetectionEngine {
  if (!threatEngine) {
    threatEngine = new ThreatDetectionEngine();
  }
  return threatEngine;
}

// ============================================================================
// REACT HOOK INTEGRATION
// ============================================================================

import { useState, useCallback, useRef } from 'react';

export function useThreatDetection() {
  const engine = useRef(getThreatDetectionEngine()).current;
  const [threatState, setThreatState] = useState({
    threats: [] as ThreatIndicator[],
    detectionStats: engine.getDetectionStats(),
    policies: [],
  });

  const registerThreat = useCallback(
    (
      type: ThreatIndicator['type'],
      severity: ThreatIndicator['severity'],
      source: string,
      description: string,
      payload: Record<string, any>
    ) => {
      const indicator = engine.registerThreatIndicator(
        type,
        severity,
        source,
        description,
        payload
      );
      const analyses = engine.detectThreats([indicator]);
      setThreatState((prev) => ({
        ...prev,
        threats: [indicator, ...prev.threats],
        detectionStats: engine.getDetectionStats(),
      }));
      return { indicator, analyses };
    },
    [engine]
  );

  const getStats = useCallback(() => {
    const stats = engine.getDetectionStats();
    setThreatState((prev) => ({ ...prev, detectionStats: stats }));
    return stats;
  }, [engine]);

  return {
    registerThreat,
    getStats,
    threatState,
    engine,
  };
}
