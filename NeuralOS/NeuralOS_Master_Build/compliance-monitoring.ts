/**
 * Continuous Security Compliance Monitoring
 * Tracks compliance with regulations (GDPR, HIPAA, SOC 2), security standards,
 * and generates compliance reports with remediation tracking
 */

import crypto from 'crypto';

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

interface ComplianceControl {
  id: string;
  name: string;
  framework: 'GDPR' | 'HIPAA' | 'SOC2' | 'ISO27001' | 'PCI-DSS' | 'CUSTOM';
  controlId: string; // e.g., "AC-1", "IA-7"
  description: string;
  requirement: string;
  criticality: 'mandatory' | 'required' | 'recommended';
  status: 'compliant' | 'non-compliant' | 'partial' | 'unknown';
  lastAuditDate: number;
  nextAuditDate: number;
  evidence: string[];
  implementationDetails: Record<string, any>;
}

interface ComplianceViolation {
  id: string;
  timestamp: number;
  controlId: string;
  framework: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  description: string;
  affectedSystems: string[];
  root causes: string[];
  remediationSteps: string[];
  estimatedRemediationTime: number; // In hours
  status: 'open' | 'in-progress' | 'resolved' | 'waived';
  resolvedAt?: number;
  resolvedBy?: string;
}

interface AuditTrail {
  timestamp: number;
  userId: string;
  action: string;
  resourceType: string;
  resourceId: string;
  before: Record<string, any>;
  after: Record<string, any>;
  status: 'success' | 'failed';
  details: Record<string, any>;
}

interface CompliancePolicy {
  id: string;
  name: string;
  frameworks: string[];
  rules: Array<{
    id: string;
    condition: string;
    action: string;
    severity: string;
  }>;
  reviewSchedule: 'monthly' | 'quarterly' | 'annually';
  enabled: boolean;
  createdAt: number;
}

interface ComplianceReport {
  id: string;
  timestamp: number;
  framework: string;
  reportPeriod: { start: number; end: number };
  controlsAudited: number;
  compliantControls: number;
  nonCompliantControls: number;
  partialControls: number;
  overallScore: number; // 0-100
  violations: ComplianceViolation[];
  recommendations: string[];
  signatures: {
    preparedBy: string;
    approvedBy?: string;
    timestamp: number;
  };
}

interface DataProcessingActivity {
  id: string;
  description: string;
  dataCategories: string[];
  purposes: string[];
  legalBasis: string;
  processingLocations: string[];
  retentionPeriod: number; // In days
  recipients: string[];
  riskAssessment: {
    likelihood: 'low' | 'medium' | 'high';
    impact: 'low' | 'medium' | 'high';
    overallRisk: 'low' | 'medium' | 'high';
  };
  mitigationMeasures: string[];
}

// ============================================================================
// COMPLIANCE MONITORING ENGINE
// ============================================================================

export class ComplianceMonitoringEngine {
  private controls: Map<string, ComplianceControl> = new Map();
  private violations: Map<string, ComplianceViolation> = new Map();
  private auditTrail: AuditTrail[] = [];
  private policies: Map<string, CompliancePolicy> = new Map();
  private dataProcessingActivities: Map<string, DataProcessingActivity> = new Map();
  private complianceReports: Map<string, ComplianceReport> = new Map();
  private policySchedule: Map<string, NodeJS.Timer> = new Map();
  private maxAuditTrailSize: number = 1000000;
  private maxViolationHistory: number = 100000;

  // Predefined compliance frameworks
  private complianceFrameworks: Record<string, ComplianceControl[]> = {
    GDPR: this.initializeGDPRControls(),
    HIPAA: this.initializeHIPAAControls(),
    SOC2: this.initializeSOC2Controls(),
    ISO27001: this.initializeISO27001Controls(),
    'PCI-DSS': this.initializepcidssControls(),
  };

  // ========================================================================
  // CONTROL MANAGEMENT
  // ========================================================================

  /**
   * Register compliance control
   */
  registerControl(
    controlId: string,
    name: string,
    framework: string,
    requirement: string,
    options: {
      criticality?: 'mandatory' | 'required' | 'recommended';
      implementationDetails?: Record<string, any>;
    } = {}
  ): ComplianceControl {
    const id = this.generateControlId();

    const control: ComplianceControl = {
      id,
      name,
      framework: framework as any,
      controlId,
      description: `${framework} - ${controlId}: ${name}`,
      requirement,
      criticality: options.criticality || 'required',
      status: 'unknown',
      lastAuditDate: 0,
      nextAuditDate: Date.now() + 2592000000, // 30 days
      evidence: [],
      implementationDetails: options.implementationDetails || {},
    };

    this.controls.set(id, control);

    return control;
  }

  /**
   * Audit control compliance
   */
  auditControl(
    controlId: string,
    isCompliant: boolean,
    evidence: string[],
    details: Record<string, any> = {}
  ): ComplianceControl | null {
    const control = Array.from(this.controls.values()).find(
      (c) => c.controlId === controlId
    );

    if (!control) {
      return null;
    }

    const previousStatus = control.status;
    control.status = isCompliant ? 'compliant' : 'non-compliant';
    control.lastAuditDate = Date.now();
    control.nextAuditDate = Date.now() + 2592000000; // 30 days
    control.evidence = [...control.evidence, ...evidence];

    // Log audit
    this.recordAuditTrail({
      timestamp: Date.now(),
      userId: 'audit-system',
      action: 'control-audit',
      resourceType: 'compliance-control',
      resourceId: controlId,
      before: { status: previousStatus },
      after: { status: control.status },
      status: 'success',
      details,
    });

    // Create violation if non-compliant
    if (!isCompliant && previousStatus === 'compliant') {
      this.createViolation(controlId, control.framework, details);
    }

    return control;
  }

  /**
   * Get control status
   */
  getControlStatus(framework?: string): Record<string, any> {
    const controls = framework
      ? Array.from(this.controls.values()).filter((c) => c.framework === framework)
      : Array.from(this.controls.values());

    const statusCounts: Record<string, number> = {};
    for (const control of controls) {
      statusCounts[control.status] = (statusCounts[control.status] || 0) + 1;
    }

    const compliant = statusCounts['compliant'] || 0;
    const total = controls.length;
    const complianceScore = total > 0 ? (compliant / total) * 100 : 0;

    return {
      framework,
      totalControls: total,
      ...statusCounts,
      complianceScore,
    };
  }

  /**
   * List all controls
   */
  listControls(framework?: string): ComplianceControl[] {
    if (!framework) {
      return Array.from(this.controls.values());
    }

    return Array.from(this.controls.values()).filter((c) => c.framework === framework);
  }

  // ========================================================================
  // VIOLATION TRACKING
  // ========================================================================

  /**
   * Create compliance violation
   */
  createViolation(
    controlId: string,
    framework: string,
    details: Record<string, any> = {}
  ): ComplianceViolation {
    const violationId = this.generateViolationId();

    const violation: ComplianceViolation = {
      id: violationId,
      timestamp: Date.now(),
      controlId,
      framework,
      severity: details.severity || 'high',
      description: details.description || `Non-compliance with ${controlId}`,
      affectedSystems: details.affectedSystems || [],
      'root causes': details.rootCauses || [],
      remediationSteps: details.remediationSteps || [],
      estimatedRemediationTime: details.estimatedTime || 24,
      status: 'open',
    };

    this.violations.set(violationId, violation);
    this.pruneViolationHistory();

    return violation;
  }

  /**
   * Get open violations
   */
  getOpenViolations(): ComplianceViolation[] {
    return Array.from(this.violations.values()).filter((v) => v.status === 'open');
  }

  /**
   * Resolve violation
   */
  resolveViolation(
    violationId: string,
    resolvedBy: string,
    verificationDetails: Record<string, any> = {}
  ): boolean {
    const violation = this.violations.get(violationId);

    if (!violation) {
      return false;
    }

    violation.status = 'resolved';
    violation.resolvedAt = Date.now();
    violation.resolvedBy = resolvedBy;

    this.recordAuditTrail({
      timestamp: Date.now(),
      userId: resolvedBy,
      action: 'violation-resolved',
      resourceType: 'compliance-violation',
      resourceId: violationId,
      before: { status: 'open' },
      after: { status: 'resolved' },
      status: 'success',
      details: verificationDetails,
    });

    return true;
  }

  /**
   * Get violation summary
   */
  getViolationSummary(): Record<string, any> {
    const violations = Array.from(this.violations.values());

    const bySeverity: Record<string, number> = {};
    const byFramework: Record<string, number> = {};
    const byStatus: Record<string, number> = {};

    for (const v of violations) {
      bySeverity[v.severity] = (bySeverity[v.severity] || 0) + 1;
      byFramework[v.framework] = (byFramework[v.framework] || 0) + 1;
      byStatus[v.status] = (byStatus[v.status] || 0) + 1;
    }

    return {
      totalViolations: violations.length,
      openViolations: byStatus['open'] || 0,
      bySeverity,
      byFramework,
      byStatus,
    };
  }

  // ========================================================================
  // AUDIT TRAIL
  // ========================================================================

  /**
   * Record audit trail entry
   */
  recordAuditTrail(entry: AuditTrail): void {
    this.auditTrail.push(entry);
    this.pruneAuditTrail();
  }

  /**
   * Get audit trail
   */
  getAuditTrail(limit: number = 1000): AuditTrail[] {
    return this.auditTrail.slice(-limit);
  }

  /**
   * Search audit trail
   */
  searchAuditTrail(
    query: {
      userId?: string;
      action?: string;
      resourceType?: string;
      startTime?: number;
      endTime?: number;
    },
    limit: number = 1000
  ): AuditTrail[] {
    return this.auditTrail
      .filter((entry) => {
        if (query.userId && entry.userId !== query.userId) return false;
        if (query.action && entry.action !== query.action) return false;
        if (query.resourceType && entry.resourceType !== query.resourceType) return false;
        if (query.startTime && entry.timestamp < query.startTime) return false;
        if (query.endTime && entry.timestamp > query.endTime) return false;
        return true;
      })
      .slice(-limit);
  }

  // ========================================================================
  // DATA PROCESSING ACTIVITIES (for GDPR)
  // ========================================================================

  /**
   * Register data processing activity
   */
  registerDataProcessingActivity(
    description: string,
    dataCategories: string[],
    purposes: string[],
    options: {
      legalBasis?: string;
      retentionPeriod?: number;
      processingLocations?: string[];
      recipients?: string[];
    } = {}
  ): DataProcessingActivity {
    const id = this.generateActivityId();

    const activity: DataProcessingActivity = {
      id,
      description,
      dataCategories,
      purposes,
      legalBasis: options.legalBasis || 'contract',
      processingLocations: options.processingLocations || [],
      retentionPeriod: options.retentionPeriod || 365,
      recipients: options.recipients || [],
      riskAssessment: {
        likelihood: 'low',
        impact: 'low',
        overallRisk: 'low',
      },
      mitigationMeasures: [],
    };

    this.dataProcessingActivities.set(id, activity);

    return activity;
  }

  /**
   * List data processing activities
   */
  listDataProcessingActivities(): DataProcessingActivity[] {
    return Array.from(this.dataProcessingActivities.values());
  }

  // ========================================================================
  // COMPLIANCE REPORTING
  // ========================================================================

  /**
   * Generate compliance report
   */
  generateComplianceReport(
    framework: string,
    startDate: number,
    endDate: number,
    preparedBy: string,
    approvedBy?: string
  ): ComplianceReport {
    const reportId = this.generateReportId();
    const controls = this.listControls(framework);

    const compliant = controls.filter((c) => c.status === 'compliant').length;
    const nonCompliant = controls.filter((c) => c.status === 'non-compliant').length;
    const partial = controls.filter((c) => c.status === 'partial').length;

    const totalScore =
      controls.length > 0 ? (compliant / controls.length) * 100 : 0;

    const frameViolations = Array.from(this.violations.values()).filter(
      (v) =>
        v.framework === framework &&
        v.timestamp >= startDate &&
        v.timestamp <= endDate
    );

    const recommendations: string[] = [];
    if (nonCompliant > 0) {
      recommendations.push(
        `Address ${nonCompliant} non-compliant controls with ${framework}`
      );
    }
    if (frameViolations.some((v) => v.status === 'open')) {
      recommendations.push('Resolve outstanding violations');
    }
    if (partial > 0) {
      recommendations.push(`Complete implementation of ${partial} partial controls`);
    }

    const report: ComplianceReport = {
      id: reportId,
      timestamp: Date.now(),
      framework,
      reportPeriod: { start: startDate, end: endDate },
      controlsAudited: controls.length,
      compliantControls: compliant,
      nonCompliantControls: nonCompliant,
      partialControls: partial,
      overallScore: totalScore,
      violations: frameViolations,
      recommendations,
      signatures: {
        preparedBy,
        approvedBy,
        timestamp: Date.now(),
      },
    };

    this.complianceReports.set(reportId, report);

    return report;
  }

  /**
   * List reports
   */
  listComplianceReports(framework?: string): ComplianceReport[] {
    if (!framework) {
      return Array.from(this.complianceReports.values());
    }

    return Array.from(this.complianceReports.values()).filter(
      (r) => r.framework === framework
    );
  }

  /**
   * Export report
   */
  exportReport(reportId: string): string | null {
    const report = this.complianceReports.get(reportId);

    if (!report) {
      return null;
    }

    return JSON.stringify(report, null, 2);
  }

  // ========================================================================
  // COMPLIANCE POLICIES
  // ========================================================================

  /**
   * Create compliance policy
   */
  createPolicy(
    name: string,
    frameworks: string[],
    reviewSchedule: 'monthly' | 'quarterly' | 'annually'
  ): CompliancePolicy {
    const policyId = this.generatePolicyId();

    const policy: CompliancePolicy = {
      id: policyId,
      name,
      frameworks,
      rules: [],
      reviewSchedule,
      enabled: true,
      createdAt: Date.now(),
    };

    this.policies.set(policyId, policy);
    this.scheduleComplianceReview(policyId);

    return policy;
  }

  /**
   * Schedule compliance review
   */
  private scheduleComplianceReview(policyId: string): void {
    const policy = this.policies.get(policyId);
    if (!policy) {
      return;
    }

    const getIntervalMs = (schedule: string): number => {
      switch (schedule) {
        case 'monthly': return 2592000000;
        case 'quarterly': return 7776000000;
        case 'annually': return 31536000000;
        default: return 2592000000;
      }
    };

    const interval = setInterval(() => {
      // Trigger compliance review for all frameworks
      for (const framework of policy.frameworks) {
        this.generateComplianceReport(
          framework,
          Date.now() - getIntervalMs(policy.reviewSchedule),
          Date.now(),
          'system',
          undefined
        );
      }
    }, getIntervalMs(policy.reviewSchedule));

    this.policySchedule.set(policyId, interval);
  }

  // ========================================================================
  // FRAMEWORK INITIALIZATION
  // ========================================================================

  private initializeGDPRControls(): ComplianceControl[] {
    return [
      {
        id: 'gdpr-1',
        name: 'Lawful Basis',
        framework: 'GDPR',
        controlId: 'Article 6',
        description: 'All processing must have a lawful basis',
        requirement: 'Maintain documentation of lawful basis for all processing',
        criticality: 'mandatory',
        status: 'unknown',
        lastAuditDate: 0,
        nextAuditDate: Date.now(),
        evidence: [],
        implementationDetails: {},
      },
      {
        id: 'gdpr-2',
        name: 'Consent Management',
        framework: 'GDPR',
        controlId: 'Article 7',
        description: 'Obtain and document explicit consent',
        requirement: 'Implement consent management system',
        criticality: 'mandatory',
        status: 'unknown',
        lastAuditDate: 0,
        nextAuditDate: Date.now(),
        evidence: [],
        implementationDetails: {},
      },
    ];
  }

  private initializeHIPAAControls(): ComplianceControl[] {
    return [
      {
        id: 'hipaa-1',
        name: 'Access Controls',
        framework: 'HIPAA',
        controlId: '164.312(a)(2)(i)',
        description: 'Implement access control measures',
        requirement: 'Unique user identification and emergency access procedures',
        criticality: 'mandatory',
        status: 'unknown',
        lastAuditDate: 0,
        nextAuditDate: Date.now(),
        evidence: [],
        implementationDetails: {},
      },
    ];
  }

  private initializeSOC2Controls(): ComplianceControl[] {
    return [
      {
        id: 'soc2-1',
        name: 'Availability',
        framework: 'SOC2',
        controlId: 'Availability',
        description: 'System is available for operation and use',
        requirement: 'Implement redundancy and failover',
        criticality: 'required',
        status: 'unknown',
        lastAuditDate: 0,
        nextAuditDate: Date.now(),
        evidence: [],
        implementationDetails: {},
      },
    ];
  }

  private initializeISO27001Controls(): ComplianceControl[] {
    return [
      {
        id: 'iso-1',
        name: 'Access Control',
        framework: 'ISO27001',
        controlId: 'A.9',
        description: 'Control access to information',
        requirement: 'Implement access control policies',
        criticality: 'required',
        status: 'unknown',
        lastAuditDate: 0,
        nextAuditDate: Date.now(),
        evidence: [],
        implementationDetails: {},
      },
    ];
  }

  private initializepcidssControls(): ComplianceControl[] {
    return [
      {
        id: 'pci-1',
        name: 'Firewalls',
        framework: 'PCI-DSS',
        controlId: 'Requirement 1',
        description: 'Install and configure firewall',
        requirement: 'Firewall configuration standards',
        criticality: 'mandatory',
        status: 'unknown',
        lastAuditDate: 0,
        nextAuditDate: Date.now(),
        evidence: [],
        implementationDetails: {},
      },
    ];
  }

  // ========================================================================
  // HELPER METHODS
  // ========================================================================

  private generateControlId(): string {
    return `ctrl_${crypto.randomBytes(12).toString('hex')}`;
  }

  private generateViolationId(): string {
    return `viol_${crypto.randomBytes(12).toString('hex')}_${Date.now()}`;
  }

  private generateActivityId(): string {
    return `act_${crypto.randomBytes(12).toString('hex')}`;
  }

  private generateReportId(): string {
    return `rep_${crypto.randomBytes(16).toString('hex')}_${Date.now()}`;
  }

  private generatePolicyId(): string {
    return `pol_${crypto.randomBytes(12).toString('hex')}`;
  }

  private pruneAuditTrail(): void {
    if (this.auditTrail.length > this.maxAuditTrailSize) {
      this.auditTrail = this.auditTrail.slice(-this.maxAuditTrailSize);
    }
  }

  private pruneViolationHistory(): void {
    if (this.violations.size > this.maxViolationHistory) {
      const entriesToDelete = this.violations.size - this.maxViolationHistory;
      let deleted = 0;

      for (const [id] of this.violations.entries()) {
        if (deleted >= entriesToDelete) break;
        this.violations.delete(id);
        deleted++;
      }
    }
  }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

let complianceEngine: ComplianceMonitoringEngine | null = null;

export function getComplianceMonitoringEngine(): ComplianceMonitoringEngine {
  if (!complianceEngine) {
    complianceEngine = new ComplianceMonitoringEngine();
  }
  return complianceEngine;
}

// ============================================================================
// REACT HOOK INTEGRATION
// ============================================================================

import { useState, useCallback, useRef } from 'react';

export function useComplianceMonitoring(framework: string = 'GDPR') {
  const engine = useRef(getComplianceMonitoringEngine()).current;
  const [complianceState, setComplianceState] = useState({
    framework,
    controls: engine.listControls(framework),
    violations: engine.getViolationSummary(),
    status: engine.getControlStatus(framework),
  });

  const auditControl = useCallback(
    (controlId: string, isCompliant: boolean, evidence: string[]) => {
      const updated = engine.auditControl(controlId, isCompliant, evidence);
      setComplianceState((prev) => ({
        ...prev,
        controls: engine.listControls(framework),
        status: engine.getControlStatus(framework),
        violations: engine.getViolationSummary(),
      }));
      return updated;
    },
    [engine, framework]
  );

  const generateReport = useCallback(
    (startDate: number, endDate: number, preparedBy: string) => {
      const report = engine.generateComplianceReport(
        framework,
        startDate,
        endDate,
        preparedBy
      );
      return report;
    },
    [engine, framework]
  );

  return {
    auditControl,
    generateReport,
    complianceState,
    engine,
  };
}
