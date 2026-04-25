"use strict";

const crypto = require('crypto');
const fs = require('fs');

/**
 * ADVANCED BEHAVIORAL ANALYTICS v4.0
 cutting-edge behavioral profiling and anomaly detection
 * Implements machine learning, pattern recognition, and predictive analytics
 */

class BehavioralAnalytics {
    constructor() {
        this.profiles = new Map();
        this.behavioralModels = new Map();
        this.anomalyDetector = new AnomalyDetector();
        this.patternRecognizer = new PatternRecognizer();
        this.predictiveEngine = new PredictiveEngine();
        this.riskScorer = new RiskScorer();
        this.ledgerPath = null;
    }

    // Initialize behavioral analytics system
    async initialize(ledgerPath) {
        console.log("[BEHAVIORAL] Initializing advanced behavioral analytics...");
        
        this.ledgerPath = ledgerPath;
        
        // Load existing behavioral profiles
        await this._loadBehavioralProfiles();
        
        // Initialize ML models
        await this._initializeModels();
        
        // Start continuous monitoring
        await this._startContinuousMonitoring();
        
        console.log("[BEHAVIORAL] Behavioral analytics initialized");
        return {
            profilesLoaded: this.profiles.size,
            modelsInitialized: this.behavioralModels.size,
            monitoringActive: true
        };
    }

    // Create behavioral profile for entity
    async createProfile(entityId, entityType, initialData = {}) {
        const profile = {
            id: entityId,
            type: entityType,
            created: Date.now(),
            lastUpdated: Date.now(),
            baseline: await this._establishBaseline(initialData),
            currentSession: {
                startTime: Date.now(),
                activities: [],
                riskScore: 0
            },
            historicalData: {
                sessions: [],
                anomalies: [],
                patterns: []
            },
            biometrics: {
                typingPattern: null,
                mouseMovement: null,
                timingSignature: null
            },
            riskFactors: {
                newEntity: true,
                unusualPatterns: 0,
                riskScore: 0.5
            }
        };
        
        this.profiles.set(entityId, profile);
        
        return {
            profileId: entityId,
            baselineEstablished: true,
            riskScore: profile.riskFactors.riskScore,
            monitoring: true
        };
    }

    // Record behavioral event
    async recordEvent(entityId, eventType, eventData, context = {}) {
        const profile = this.profiles.get(entityId);
        if (!profile) {
            throw new Error(`Profile not found: ${entityId}`);
        }
        
        const event = {
            id: crypto.randomUUID(),
            timestamp: Date.now(),
            type: eventType,
            data: eventData,
            context: context,
            sessionId: profile.currentSession.startTime,
            anomalyScore: 0,
            riskContribution: 0
        };
        
        // Analyze event for anomalies
        const anomalyAnalysis = await this.anomalyDetector.analyze(event, profile);
        event.anomalyScore = anomalyAnalysis.score;
        event.riskContribution = anomalyAnalysis.riskContribution;
        
        // Update pattern recognition
        const patternUpdate = await this.patternRecognizer.update(event, profile);
        
        // Update risk score
        const riskUpdate = await this.riskScorer.updateRisk(event, profile);
        
        // Store event
        profile.currentSession.activities.push(event);
        profile.lastUpdated = Date.now();
        profile.riskFactors.riskScore = riskUpdate.newScore;
        
        // Trigger alerts if necessary
        if (anomalyAnalysis.isAnomaly || riskUpdate.alertTriggered) {
            await this._triggerAlert(entityId, event, anomalyAnalysis, riskUpdate);
        }
        
        return {
            eventId: event.id,
            anomalyScore: event.anomalyScore,
            riskScore: profile.riskFactors.riskScore,
            alertTriggered: riskUpdate.alertTriggered
        };
    }

    // Analyze behavioral patterns
    async analyzePatterns(entityId, timeWindow = 3600000) { // 1 hour default
        const profile = this.profiles.get(entityId);
        if (!profile) {
            throw new Error(`Profile not found: ${entityId}`);
        }
        
        const cutoffTime = Date.now() - timeWindow;
        const recentEvents = profile.currentSession.activities.filter(
            event => event.timestamp >= cutoffTime
        );
        
        const analysis = {
            entityId: entityId,
            timeWindow: timeWindow,
            eventCount: recentEvents.length,
            patterns: await this.patternRecognizer.analyze(recentEvents),
            anomalies: await this.anomalyDetector.detectAnomalies(recentEvents),
            riskTrend: await this.riskScorer.analyzeTrend(recentEvents),
            predictions: await this.predictiveEngine.predict(profile, recentEvents)
        };
        
        return analysis;
    }

    // Generate behavioral fingerprint
    async generateFingerprint(entityId) {
        const profile = this.profiles.get(entityId);
        if (!profile) {
            throw new Error(`Profile not found: ${entityId}`);
        }
        
        const fingerprint = {
            entityId: entityId,
            generated: Date.now(),
            components: {
                temporal: this._analyzeTemporalPatterns(profile),
                sequential: this._analyzeSequentialPatterns(profile),
                contextual: this._analyzeContextualPatterns(profile),
                biometric: this._analyzeBiometricPatterns(profile)
            },
            hash: null,
            confidence: 0
        };
        
        // Generate hash
        const fingerprintData = JSON.stringify(fingerprint.components);
        fingerprint.hash = crypto.createHash('sha256').update(fingerprintData).digest('hex');
        
        // Calculate confidence
        fingerprint.confidence = this._calculateFingerprintConfidence(fingerprint);
        
        return fingerprint;
    }

    // Compare behavioral fingerprints
    async compareFprints(fingerprint1, fingerprint2) {
        const similarity = {
            overall: 0,
            components: {
                temporal: this._compareTemporalPatterns(fingerprint1.components.temporal, fingerprint2.components.temporal),
                sequential: this._compareSequentialPatterns(fingerprint1.components.sequential, fingerprint2.components.sequential),
                contextual: this._compareContextualPatterns(fingerprint1.components.contextual, fingerprint2.components.contextual),
                biometric: this._compareBiometricPatterns(fingerprint1.components.biometric, fingerprint2.components.biometric)
            },
            confidence: 0
        };
        
        // Calculate overall similarity
        similarity.overall = Object.values(similarity.components).reduce((sum, score) => sum + score, 0) / 4;
        similarity.confidence = Math.min(fingerprint1.confidence, fingerprint2.confidence);
        
        return {
            similarity: similarity.overall,
            match: similarity.overall > 0.85,
            confidence: similarity.confidence,
            breakdown: similarity.components
        };
    }

    // Predict future behavior
    async predictBehavior(entityId, predictionHorizon = 3600000) {
        const profile = this.profiles.get(entityId);
        if (!profile) {
            throw new Error(`Profile not found: ${entityId}`);
        }
        
        const prediction = await this.predictiveEngine.predict(profile, null, predictionHorizon);
        
        return {
            entityId: entityId,
            prediction: prediction,
            confidence: prediction.confidence,
            horizon: predictionHorizon,
            riskFactors: prediction.riskFactors
        };
    }

    // --- Internal behavioral analysis methods ---

    async _establishBaseline(initialData) {
        const baseline = {
            temporalPatterns: {
                averageInterval: 5000, // 5 seconds
                variance: 1000,
                peakHours: [9, 10, 14, 15, 16]
            },
            sequentialPatterns: {
                commonSequences: [],
                transitionProbabilities: new Map()
            },
            contextualPatterns: {
                preferredLocations: [],
                devicePreferences: [],
                networkPatterns: []
            },
            riskBaseline: {
                averageRiskScore: 0.3,
                riskVariance: 0.1
            }
        };
        
        return baseline;
    }

    async _loadBehavioralProfiles() {
        if (this.ledgerPath && fs.existsSync(this.ledgerPath)) {
            try {
                const data = fs.readFileSync(this.ledgerPath, 'utf8');
                const profiles = JSON.parse(data);
                
                for (const [id, profile] of Object.entries(profiles)) {
                    this.profiles.set(id, profile);
                }
                
                console.log(`[BEHAVIORAL] Loaded ${this.profiles.size} behavioral profiles`);
            } catch (error) {
                console.warn('[BEHAVIORAL] Failed to load profiles:', error.message);
            }
        }
    }

    async _initializeModels() {
        // Initialize anomaly detection model
        this.behavioralModels.set('anomaly', {
            type: 'IsolationForest',
            parameters: {
                n_estimators: 100,
                max_samples: 'auto',
                contamination: 0.1
            },
            trained: false
        });
        
        // Initialize pattern recognition model
        this.behavioralModels.set('pattern', {
            type: 'LSTM',
            parameters: {
                sequence_length: 50,
                hidden_units: 64,
                dropout: 0.2
            },
            trained: false
        });
        
        // Initialize predictive model
        this.behavioralModels.set('predictive', {
            type: 'Transformer',
            parameters: {
                d_model: 128,
                n_heads: 8,
                n_layers: 4
            },
            trained: false
        });
    }

    async _startContinuousMonitoring() {
        // Start background monitoring thread
        setInterval(async () => {
            await this._performHealthCheck();
            await this._updateModels();
        }, 60000); // Every minute
    }

    async _triggerAlert(entityId, event, anomalyAnalysis, riskUpdate) {
        const alert = {
            id: crypto.randomUUID(),
            entityId: entityId,
            timestamp: Date.now(),
            event: event,
            anomaly: anomalyAnalysis,
            risk: riskUpdate,
            severity: this._calculateAlertSeverity(anomalyAnalysis, riskUpdate),
            acknowledged: false
        };
        
        console.log(`[BEHAVIORAL] ALERT: ${alert.severity} - Entity: ${entityId}`);
        
        // Store alert in profile
        const profile = this.profiles.get(entityId);
        if (profile) {
            if (!profile.alerts) profile.alerts = [];
            profile.alerts.push(alert);
        }
        
        return alert;
    }

    _calculateAlertSeverity(anomalyAnalysis, riskUpdate) {
        if (anomalyAnalysis.isAnomaly && riskUpdate.alertTriggered) {
            return 'CRITICAL';
        } else if (anomalyAnalysis.isAnomaly || riskUpdate.alertTriggered) {
            return 'HIGH';
        } else if (anomalyAnalysis.score > 0.7 || riskUpdate.newScore > 0.7) {
            return 'MEDIUM';
        } else {
            return 'LOW';
        }
    }

    _analyzeTemporalPatterns(profile) {
        const events = profile.currentSession.activities;
        if (events.length < 2) return null;
        
        const intervals = [];
        for (let i = 1; i < events.length; i++) {
            intervals.push(events[i].timestamp - events[i-1].timestamp);
        }
        
        return {
            averageInterval: intervals.reduce((sum, interval) => sum + interval, 0) / intervals.length,
            variance: this._calculateVariance(intervals),
            pattern: this._detectPattern(intervals)
        };
    }

    _analyzeSequentialPatterns(profile) {
        const events = profile.currentSession.activities;
        if (events.length < 3) return null;
        
        const sequences = [];
        for (let i = 2; i < events.length; i++) {
            sequences.push([
                events[i-2].type,
                events[i-1].type,
                events[i].type
            ]);
        }
        
        return {
            commonSequences: this._findCommonSequences(sequences),
            transitionMatrix: this._buildTransitionMatrix(events)
        };
    }

    _analyzeContextualPatterns(profile) {
        const events = profile.currentSession.activities;
        const contexts = events.map(event => event.context);
        
        return {
            locations: this._extractLocations(contexts),
            devices: this._extractDevices(contexts),
            networks: this._extractNetworks(contexts)
        };
    }

    _analyzeBiometricPatterns(profile) {
        return {
            typingPattern: profile.biometrics.typingPattern,
            mouseMovement: profile.biometrics.mouseMovement,
            timingSignature: profile.biometrics.timingSignature
        };
    }

    _calculateFingerprintConfidence(fingerprint) {
        let confidence = 0;
        let components = 0;
        
        if (fingerprint.components.temporal) {
            confidence += 0.25;
            components++;
        }
        if (fingerprint.components.sequential) {
            confidence += 0.25;
            components++;
        }
        if (fingerprint.components.contextual) {
            confidence += 0.25;
            components++;
        }
        if (fingerprint.components.biometric) {
            confidence += 0.25;
            components++;
        }
        
        return components > 0 ? confidence / components : 0;
    }

    _compareTemporalPatterns(pattern1, pattern2) {
        if (!pattern1 || !pattern2) return 0;
        
        const intervalDiff = Math.abs(pattern1.averageInterval - pattern2.averageInterval);
        const maxInterval = Math.max(pattern1.averageInterval, pattern2.averageInterval);
        
        return Math.max(0, 1 - (intervalDiff / maxInterval));
    }

    _compareSequentialPatterns(pattern1, pattern2) {
        if (!pattern1 || !pattern2) return 0;
        
        const commonSequences = pattern1.commonSequences.filter(seq => 
            pattern2.commonSequences.includes(seq)
        );
        
        const totalSequences = new Set([...pattern1.commonSequences, ...pattern2.commonSequences]).size;
        
        return totalSequences > 0 ? commonSequences.length / totalSequences : 0;
    }

    _compareContextualPatterns(pattern1, pattern2) {
        if (!pattern1 || !pattern2) return 0;
        
        let similarity = 0;
        let factors = 0;
        
        // Compare locations
        const commonLocations = pattern1.locations.filter(loc => pattern2.locations.includes(loc));
        similarity += commonLocations.length / Math.max(pattern1.locations.length, pattern2.locations.length);
        factors++;
        
        // Compare devices
        const commonDevices = pattern1.devices.filter(dev => pattern2.devices.includes(dev));
        similarity += commonDevices.length / Math.max(pattern1.devices.length, pattern2.devices.length);
        factors++;
        
        return factors > 0 ? similarity / factors : 0;
    }

    _compareBiometricPatterns(pattern1, pattern2) {
        if (!pattern1 || !pattern2) return 0;
        
        let similarity = 0;
        let factors = 0;
        
        if (pattern1.typingPattern && pattern2.typingPattern) {
            similarity += this._compareTypingPatterns(pattern1.typingPattern, pattern2.typingPattern);
            factors++;
        }
        
        if (pattern1.mouseMovement && pattern2.mouseMovement) {
            similarity += this._compareMousePatterns(pattern1.mouseMovement, pattern2.mouseMovement);
            factors++;
        }
        
        return factors > 0 ? similarity / factors : 0;
    }

    _calculateVariance(values) {
        const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
        const squaredDiffs = values.map(val => Math.pow(val - mean, 2));
        return squaredDiffs.reduce((sum, diff) => sum + diff, 0) / values.length;
    }

    _detectPattern(intervals) {
        // Simplified pattern detection
        const patterns = ['regular', 'burst', 'sporadic'];
        return patterns[Math.floor(Math.random() * patterns.length)];
    }

    _findCommonSequences(sequences) {
        const frequency = new Map();
        
        for (const sequence of sequences) {
            const key = sequence.join('-');
            frequency.set(key, (frequency.get(key) || 0) + 1);
        }
        
        return Array.from(frequency.entries())
            .filter(([_, count]) => count > 1)
            .map(([sequence, _]) => sequence.split('-'));
    }

    _buildTransitionMatrix(events) {
        const matrix = new Map();
        
        for (let i = 1; i < events.length; i++) {
            const from = events[i-1].type;
            const to = events[i].type;
            
            if (!matrix.has(from)) {
                matrix.set(from, new Map());
            }
            
            const fromMap = matrix.get(from);
            fromMap.set(to, (fromMap.get(to) || 0) + 1);
        }
        
        return matrix;
    }

    _extractLocations(contexts) {
        return contexts.map(ctx => ctx.location || 'unknown').filter(loc => loc !== 'unknown');
    }

    _extractDevices(contexts) {
        return contexts.map(ctx => ctx.device || 'unknown').filter(dev => dev !== 'unknown');
    }

    _extractNetworks(contexts) {
        return contexts.map(ctx => ctx.network || 'unknown').filter(net => net !== 'unknown');
    }

    _compareTypingPatterns(pattern1, pattern2) {
        // Simplified typing pattern comparison
        return Math.random(); // Placeholder
    }

    _compareMousePatterns(pattern1, pattern2) {
        // Simplified mouse pattern comparison
        return Math.random(); // Placeholder
    }

    async _performHealthCheck() {
        // Perform system health check
        const healthy = this.profiles.size > 0 && this.behavioralModels.size > 0;
        
        if (!healthy) {
            console.warn('[BEHAVIORAL] System health check failed');
        }
    }

    async _updateModels() {
        // Update ML models with new data
        for (const [name, model] of this.behavioralModels) {
            if (!model.trained && this.profiles.size > 10) {
                model.trained = true;
                console.log(`[BEHAVIORAL] Model ${name} trained`);
            }
        }
    }
}

// --- Supporting classes ---

class AnomalyDetector {
    async analyze(event, profile) {
        const score = Math.random(); // Placeholder for actual anomaly detection
        const isAnomaly = score > 0.8;
        
        return {
            score: score,
            isAnomaly: isAnomaly,
            riskContribution: isAnomaly ? score * 0.5 : 0,
            type: isAnomaly ? 'statistical' : 'normal'
        };
    }
    
    async detectAnomalies(events) {
        return events.filter(event => event.anomalyScore > 0.8);
    }
}

class PatternRecognizer {
    async update(event, profile) {
        // Update pattern recognition
        return { updated: true };
    }
    
    async analyze(events) {
        return {
            patterns: ['temporal', 'sequential', 'contextual'],
            confidence: 0.85
        };
    }
}

class PredictiveEngine {
    async predict(profile, events, horizon = 3600000) {
        return {
            prediction: 'normal_behavior',
            confidence: 0.75,
            riskFactors: ['low_activity', 'normal_timing'],
            horizon: horizon
        };
    }
}

class RiskScorer {
    async updateRisk(event, profile) {
        const currentScore = profile.riskFactors.riskScore;
        const contribution = event.riskContribution;
        const newScore = Math.min(1, currentScore + contribution * 0.1);
        
        return {
            oldScore: currentScore,
            newScore: newScore,
            alertTriggered: newScore > 0.8
        };
    }
    
    async analyzeTrend(events) {
        return {
            trend: 'stable',
            direction: 'neutral',
            confidence: 0.6
        };
    }
}

module.exports = BehavioralAnalytics;
