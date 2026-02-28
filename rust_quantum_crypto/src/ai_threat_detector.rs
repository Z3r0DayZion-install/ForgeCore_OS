//! AI-POWERED THREAT DETECTION (RUST)
//! 
//! Advanced threat detection system using machine learning techniques
//! for real-time security monitoring and anomaly detection.

use std::collections::{HashMap, VecDeque};
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant, SystemTime, UNIX_EPOCH};
use serde::{Serialize, Deserialize};
use thiserror::Error;
use ndarray::{Array1, Array2};
use rand::Rng;

#[derive(Error, Debug)]
pub enum ThreatDetectionError {
    #[error("Model initialization failed: {0}")]
    ModelInitializationError(String),
    #[error("Feature extraction failed: {0}")]
    FeatureExtractionError(String),
    #[error("Prediction failed: {0}")]
    PredictionError(String),
    #[error("Invalid input data")]
    InvalidInputData,
}

/// Threat severity levels
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, PartialOrd, Ord)]
pub enum ThreatSeverity {
    Low,
    Medium,
    High,
    Critical,
}

/// Threat types
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ThreatType {
    SuspiciousProcess,
    NetworkAnomaly,
    FileSystemAnomaly,
    MemoryAnomaly,
    BehavioralAnomaly,
    CryptographicAnomaly,
    Unknown,
}

/// Threat event
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ThreatEvent {
    pub id: String,
    pub timestamp: u64,
    pub threat_type: ThreatType,
    pub severity: ThreatSeverity,
    pub confidence: f64,
    pub description: String,
    pub source: String,
    pub features: HashMap<String, f64>,
    pub recommendations: Vec<String>,
}

/// Feature vector for ML models
#[derive(Debug, Clone)]
pub struct FeatureVector {
    pub features: Vec<f64>,
    pub timestamp: u64,
    pub source: String,
}

/// ML Model trait
pub trait MLModel {
    fn predict(&self, features: &FeatureVector) -> Result<f64, ThreatDetectionError>;
    fn train(&mut self, training_data: &[(FeatureVector, f64)]) -> Result<(), ThreatDetectionError>;
    fn is_trained(&self) -> bool;
}

/// Simple neural network for threat detection
pub struct ThreatDetectionModel {
    weights: Vec<Vec<f64>>,
    biases: Vec<f64>,
    input_size: usize,
    hidden_size: usize,
    output_size: usize,
    trained: bool,
    learning_rate: f64,
}

impl ThreatDetectionModel {
    pub fn new(input_size: usize, hidden_size: usize) -> Self {
        let output_size = 1;
        
        // Initialize weights with Xavier initialization
        let mut rng = rand::thread_rng();
        let weights = vec![
            (0..hidden_size).map(|_| {
                (0..input_size).map(|_| rng.gen_range(-1.0..1.0) * (2.0 / input_size as f64).sqrt()).collect()
            }).collect(),
            (0..output_size).map(|_| {
                (0..hidden_size).map(|_| rng.gen_range(-1.0..1.0) * (2.0 / hidden_size as f64).sqrt()).collect()
            }).collect(),
        ];
        
        let biases = vec![
            (0..hidden_size).map(|_| 0.0).collect(),
            (0..output_size).map(|_| 0.0).collect(),
        ];
        
        Self {
            weights,
            biases,
            input_size,
            hidden_size,
            output_size,
            trained: false,
            learning_rate: 0.01,
        }
    }
    
    fn forward(&self, input: &[f64]) -> Vec<f64> {
        // Hidden layer
        let mut hidden = vec![0.0; self.hidden_size];
        for (i, weight_row) in self.weights[0].iter().enumerate() {
            let mut sum = self.biases[0][i];
            for (j, &weight) in weight_row.iter().enumerate() {
                sum += weight * input[j];
            }
            hidden[i] = self.relu(sum);
        }
        
        // Output layer
        let mut output = vec![0.0; self.output_size];
        for (i, weight_row) in self.weights[1].iter().enumerate() {
            let mut sum = self.biases[1][i];
            for (j, &weight) in weight_row.iter().enumerate() {
                sum += weight * hidden[j];
            }
            output[i] = self.sigmoid(sum);
        }
        
        output
    }
    
    fn relu(&self, x: f64) -> f64 {
        x.max(0.0)
    }
    
    fn sigmoid(&self, x: f64) -> f64 {
        1.0 / (1.0 + (-x).exp())
    }
    
    fn backward(&mut self, input: &[f64], target: f64, output: &[f64]) {
        // Calculate output layer error
        let output_error = output[0] - target;
        let output_delta = output_error * output[0] * (1.0 - output[0]);
        
        // Calculate hidden layer
        let mut hidden = vec![0.0; self.hidden_size];
        for (i, weight_row) in self.weights[0].iter().enumerate() {
            let mut sum = self.biases[0][i];
            for (j, &weight) in weight_row.iter().enumerate() {
                sum += weight * input[j];
            }
            hidden[i] = self.relu(sum);
        }
        
        // Calculate hidden layer errors
        let mut hidden_errors = vec![0.0; self.hidden_size];
        for i in 0..self.hidden_size {
            hidden_errors[i] = output_delta * self.weights[1][0][i] * hidden[i] * (1.0 - hidden[i]);
        }
        
        // Update weights and biases
        // Output layer
        for i in 0..self.output_size {
            for j in 0..self.hidden_size {
                self.weights[1][i][j] -= self.learning_rate * output_delta * hidden[j];
            }
            self.biases[1][i] -= self.learning_rate * output_delta;
        }
        
        // Hidden layer
        for i in 0..self.hidden_size {
            for j in 0..self.input_size {
                self.weights[0][i][j] -= self.learning_rate * hidden_errors[i] * input[j];
            }
            self.biases[0][i] -= self.learning_rate * hidden_errors[i];
        }
    }
}

impl MLModel for ThreatDetectionModel {
    fn predict(&self, features: &FeatureVector) -> Result<f64, ThreatDetectionError> {
        if features.features.len() != self.input_size {
            return Err(ThreatDetectionError::InvalidInputData);
        }
        
        let output = self.forward(&features.features);
        Ok(output[0])
    }
    
    fn train(&mut self, training_data: &[(FeatureVector, f64)]) -> Result<(), ThreatDetectionError> {
        for epoch in 0..100 {
            for (features, target) in training_data {
                if features.features.len() != self.input_size {
                    return Err(ThreatDetectionError::InvalidInputData);
                }
                
                let output = self.forward(&features.features);
                self.backward(&features.features, *target, &output);
            }
        }
        
        self.trained = true;
        Ok(())
    }
    
    fn is_trained(&self) -> bool {
        self.trained
    }
}

/// AI Threat Detector
pub struct AIThreatDetector {
    models: HashMap<ThreatType, Box<dyn MLModel>>,
    feature_history: Arc<Mutex<VecDeque<FeatureVector>>>,
    threat_history: Arc<Mutex<VecDeque<ThreatEvent>>>,
    anomaly_threshold: f64,
    max_history_size: usize,
}

impl AIThreatDetector {
    pub fn new() -> Self {
        let mut models: HashMap<ThreatType, Box<dyn MLModel>> = HashMap::new();
        
        // Initialize models for different threat types
        models.insert(ThreatType::SuspiciousProcess, 
                     Box::new(ThreatDetectionModel::new(10, 20)));
        models.insert(ThreatType::NetworkAnomaly, 
                     Box::new(ThreatDetectionModel::new(15, 30)));
        models.insert(ThreatType::FileSystemAnomaly, 
                     Box::new(ThreatDetectionModel::new(8, 16)));
        models.insert(ThreatType::MemoryAnomaly, 
                     Box::new(ThreatDetectionModel::new(12, 24)));
        models.insert(ThreatType::BehavioralAnomaly, 
                     Box::new(ThreatDetectionModel::new(20, 40)));
        models.insert(ThreatType::CryptographicAnomaly, 
                     Box::new(ThreatDetectionModel::new(6, 12)));
        
        Self {
            models,
            feature_history: Arc::new(Mutex::new(VecDeque::with_capacity(10000))),
            threat_history: Arc::new(Mutex::new(VecDeque::with_capacity(1000))),
            anomaly_threshold: 0.7,
            max_history_size: 10000,
        }
    }
    
    /// Analyze system behavior for threats
    pub fn analyze_behavior(&mut self, behavior_data: &HashMap<String, f64>) -> Result<Vec<ThreatEvent>, ThreatDetectionError> {
        let mut threats = Vec::new();
        let timestamp = SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_secs();
        
        // Extract features for different threat types
        let process_features = self.extract_process_features(behavior_data)?;
        let network_features = self.extract_network_features(behavior_data)?;
        let filesystem_features = self.extract_filesystem_features(behavior_data)?;
        let memory_features = self.extract_memory_features(behavior_data)?;
        let behavioral_features = self.extract_behavioral_features(behavior_data)?;
        let crypto_features = self.extract_crypto_features(behavior_data)?;
        
        // Analyze each threat type
        if let Some(model) = self.models.get_mut(&ThreatType::SuspiciousProcess) {
            if model.is_trained() {
                let prediction = model.predict(&process_features)?;
                if prediction > self.anomaly_threshold {
                    threats.push(self.create_threat_event(
                        ThreatType::SuspiciousProcess,
                        prediction,
                        "Suspicious process activity detected",
                        behavior_data,
                    ));
                }
            }
        }
        
        if let Some(model) = self.models.get_mut(&ThreatType::NetworkAnomaly) {
            if model.is_trained() {
                let prediction = model.predict(&network_features)?;
                if prediction > self.anomaly_threshold {
                    threats.push(self.create_threat_event(
                        ThreatType::NetworkAnomaly,
                        prediction,
                        "Network anomaly detected",
                        behavior_data,
                    ));
                }
            }
        }
        
        if let Some(model) = self.models.get_mut(&ThreatType::FileSystemAnomaly) {
            if model.is_trained() {
                let prediction = model.predict(&filesystem_features)?;
                if prediction > self.anomaly_threshold {
                    threats.push(self.create_threat_event(
                        ThreatType::FileSystemAnomaly,
                        prediction,
                        "File system anomaly detected",
                        behavior_data,
                    ));
                }
            }
        }
        
        if let Some(model) = self.models.get_mut(&ThreatType::MemoryAnomaly) {
            if model.is_trained() {
                let prediction = model.predict(&memory_features)?;
                if prediction > self.anomaly_threshold {
                    threats.push(self.create_threat_event(
                        ThreatType::MemoryAnomaly,
                        prediction,
                        "Memory usage anomaly detected",
                        behavior_data,
                    ));
                }
            }
        }
        
        if let Some(model) = self.models.get_mut(&ThreatType::BehavioralAnomaly) {
            if model.is_trained() {
                let prediction = model.predict(&behavioral_features)?;
                if prediction > self.anomaly_threshold {
                    threats.push(self.create_threat_event(
                        ThreatType::BehavioralAnomaly,
                        prediction,
                        "Behavioral anomaly detected",
                        behavior_data,
                    ));
                }
            }
        }
        
        if let Some(model) = self.models.get_mut(&ThreatType::CryptographicAnomaly) {
            if model.is_trained() {
                let prediction = model.predict(&crypto_features)?;
                if prediction > self.anomaly_threshold {
                    threats.push(self.create_threat_event(
                        ThreatType::CryptographicAnomaly,
                        prediction,
                        "Cryptographic anomaly detected",
                        behavior_data,
                    ));
                }
            }
        }
        
        // Store threats in history
        if !threats.is_empty() {
            let mut history = self.threat_history.lock().unwrap();
            for threat in &threats {
                history.push_back(threat.clone());
                if history.len() > 1000 {
                    history.pop_front();
                }
            }
        }
        
        Ok(threats)
    }
    
    /// Train models with historical data
    pub fn train_models(&mut self, training_data: &[(HashMap<String, f64>, bool)]) -> Result<(), ThreatDetectionError> {
        // Separate training data by threat type
        let mut process_data = Vec::new();
        let mut network_data = Vec::new();
        let mut filesystem_data = Vec::new();
        let mut memory_data = Vec::new();
        let mut behavioral_data = Vec::new();
        let mut crypto_data = Vec::new();
        
        for (behavior_data, is_threat) in training_data {
            let target = if *is_threat { 1.0 } else { 0.0 };
            
            process_data.push((self.extract_process_features(behavior_data)?, target));
            network_data.push((self.extract_network_features(behavior_data)?, target));
            filesystem_data.push((self.extract_filesystem_features(behavior_data)?, target));
            memory_data.push((self.extract_memory_features(behavior_data)?, target));
            behavioral_data.push((self.extract_behavioral_features(behavior_data)?, target));
            crypto_data.push((self.extract_crypto_features(behavior_data)?, target));
        }
        
        // Train each model
        if let Some(model) = self.models.get_mut(&ThreatType::SuspiciousProcess) {
            model.train(&process_data)?;
        }
        
        if let Some(model) = self.models.get_mut(&ThreatType::NetworkAnomaly) {
            model.train(&network_data)?;
        }
        
        if let Some(model) = self.models.get_mut(&ThreatType::FileSystemAnomaly) {
            model.train(&filesystem_data)?;
        }
        
        if let Some(model) = self.models.get_mut(&ThreatType::MemoryAnomaly) {
            model.train(&memory_data)?;
        }
        
        if let Some(model) = self.models.get_mut(&ThreatType::BehavioralAnomaly) {
            model.train(&behavioral_data)?;
        }
        
        if let Some(model) = self.models.get_mut(&ThreatType::CryptographicAnomaly) {
            model.train(&crypto_data)?;
        }
        
        Ok(())
    }
    
    /// Get threat statistics
    pub fn get_threat_statistics(&self) -> HashMap<ThreatType, usize> {
        let history = self.threat_history.lock().unwrap();
        let mut stats = HashMap::new();
        
        for threat in history.iter() {
            *stats.entry(threat.threat_type.clone()).or_insert(0) += 1;
        }
        
        stats
    }
    
    /// Get recent threats
    pub fn get_recent_threats(&self, limit: usize) -> Vec<ThreatEvent> {
        let history = self.threat_history.lock().unwrap();
        history.iter().rev().take(limit).cloned().collect()
    }
    
    /// Clear threat history
    pub fn clear_threat_history(&self) {
        self.threat_history.lock().unwrap().clear();
    }
    
    /// Set anomaly threshold
    pub fn set_anomaly_threshold(&mut self, threshold: f64) {
        self.anomaly_threshold = threshold.clamp(0.0, 1.0);
    }
    
    /// Extract process-related features
    fn extract_process_features(&self, data: &HashMap<String, f64>) -> Result<FeatureVector, ThreatDetectionError> {
        let features = vec![
            data.get("cpu_usage").unwrap_or(&0.0),
            data.get("memory_usage").unwrap_or(&0.0),
            data.get("process_count").unwrap_or(&0.0),
            data.get("thread_count").unwrap_or(&0.0),
            data.get("handle_count").unwrap_or(&0.0),
            data.get("page_faults").unwrap_or(&0.0),
            data.get("context_switches").unwrap_or(&0.0),
            data.get("system_calls").unwrap_or(&0.0),
            data.get("file_operations").unwrap_or(&0.0),
            data.get("network_operations").unwrap_or(&0.0),
        ];
        
        Ok(FeatureVector {
            features,
            timestamp: SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_secs(),
            source: "process".to_string(),
        })
    }
    
    /// Extract network-related features
    fn extract_network_features(&self, data: &HashMap<String, f64>) -> Result<FeatureVector, ThreatDetectionError> {
        let features = vec![
            data.get("bytes_sent").unwrap_or(&0.0),
            data.get("bytes_received").unwrap_or(&0.0),
            data.get("packets_sent").unwrap_or(&0.0),
            data.get("packets_received").unwrap_or(&0.0),
            data.get("connections_established").unwrap_or(&0.0),
            data.get("connections_failed").unwrap_or(&0.0),
            data.get("dns_queries").unwrap_or(&0.0),
            data.get("dns_failures").unwrap_or(&0.0),
            data.get("tcp_connections").unwrap_or(&0.0),
            data.get("udp_connections").unwrap_or(&0.0),
            data.get("connection_duration").unwrap_or(&0.0),
            data.get("bandwidth_utilization").unwrap_or(&0.0),
            data.get("latency").unwrap_or(&0.0),
            data.get("packet_loss").unwrap_or(&0.0),
            data.get("error_rate").unwrap_or(&0.0),
        ];
        
        Ok(FeatureVector {
            features,
            timestamp: SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_secs(),
            source: "network".to_string(),
        })
    }
    
    /// Extract filesystem-related features
    fn extract_filesystem_features(&self, data: &HashMap<String, f64>) -> Result<FeatureVector, ThreatDetectionError> {
        let features = vec![
            data.get("file_reads").unwrap_or(&0.0),
            data.get("file_writes").unwrap_or(&0.0),
            data.get("file_deletes").unwrap_or(&0.0),
            data.get("file_creates").unwrap_or(&0.0),
            data.get("directory_operations").unwrap_or(&0.0),
            data.get("permission_changes").unwrap_or(&0.0),
            data.get("file_size_changes").unwrap_or(&0.0),
            data.get("file_type_changes").unwrap_or(&0.0),
        ];
        
        Ok(FeatureVector {
            features,
            timestamp: SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_secs(),
            source: "filesystem".to_string(),
        })
    }
    
    /// Extract memory-related features
    fn extract_memory_features(&self, data: &HashMap<String, f64>) -> Result<FeatureVector, ThreatDetectionError> {
        let features = vec![
            data.get("virtual_memory_used").unwrap_or(&0.0),
            data.get("physical_memory_used").unwrap_or(&0.0),
            data.get("page_file_used").unwrap_or(&0.0),
            data.get("cache_memory_used").unwrap_or(&0.0),
            data.get("non_paged_memory").unwrap_or(&0.0),
            data.get("paged_memory").unwrap_or(&0.0),
            data.get("memory_allocations").unwrap_or(&0.0),
            data.get("memory_deallocations").unwrap_or(&0.0),
            data.get("memory_leaks").unwrap_or(&0.0),
            data.get("heap_fragmentation").unwrap_or(&0.0),
            data.get("stack_usage").unwrap_or(&0.0),
            data.get("memory_pressure").unwrap_or(&0.0),
        ];
        
        Ok(FeatureVector {
            features,
            timestamp: SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_secs(),
            source: "memory".to_string(),
        })
    }
    
    /// Extract behavioral features
    fn extract_behavioral_features(&self, data: &HashMap<String, f64>) -> Result<FeatureVector, ThreatDetectionError> {
        let features = vec![
            data.get("user_interactions").unwrap_or(&0.0),
            data.get("keyboard_events").unwrap_or(&0.0),
            data.get("mouse_events").unwrap_or(&0.0),
            data.get("window_operations").unwrap_or(&0.0),
            data.get("application_switches").unwrap_or(&0.0),
            data.get("idle_time").unwrap_or(&0.0),
            data.get("active_time").unwrap_or(&0.0),
            data.get("error_events").unwrap_or(&0.0),
            data.get("warning_events").unwrap_or(&0.0),
            data.get("system_events").unwrap_or(&0.0),
            data.get("security_events").unwrap_or(&0.0),
            data.get("performance_events").unwrap_or(&0.0),
            data.get("network_events").unwrap_or(&0.0),
            data.get("file_events").unwrap_or(&0.0),
            data.get("registry_events").unwrap_or(&0.0),
            data.get("process_events").unwrap_or(&0.0),
            data.get("service_events").unwrap_or(&0.0),
            data.get("driver_events").unwrap_or(&0.0),
            data.get("device_events").unwrap_or(&0.0),
            data.get("power_events").unwrap_or(&0.0),
        ];
        
        Ok(FeatureVector {
            features,
            timestamp: SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_secs(),
            source: "behavioral".to_string(),
        })
    }
    
    /// Extract cryptographic features
    fn extract_crypto_features(&self, data: &HashMap<String, f64>) -> Result<FeatureVector, ThreatDetectionError> {
        let features = vec![
            data.get("encryption_operations").unwrap_or(&0.0),
            data.get("decryption_operations").unwrap_or(&0.0),
            data.get("hash_operations").unwrap_or(&0.0),
            data.get("signature_operations").unwrap_or(&0.0),
            data.get("verification_operations").unwrap_or(&0.0),
            data.get("key_generation_operations").unwrap_or(&0.0),
        ];
        
        Ok(FeatureVector {
            features,
            timestamp: SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_secs(),
            source: "cryptographic".to_string(),
        })
    }
    
    /// Create threat event
    fn create_threat_event(&self, threat_type: ThreatType, confidence: f64, description: &str, features: &HashMap<String, f64>) -> ThreatEvent {
        let severity = if confidence > 0.9 {
            ThreatSeverity::Critical
        } else if confidence > 0.8 {
            ThreatSeverity::High
        } else if confidence > 0.6 {
            ThreatSeverity::Medium
        } else {
            ThreatSeverity::Low
        };
        
        let recommendations = match threat_type {
            ThreatType::SuspiciousProcess => vec![
                "Investigate the suspicious process".to_string(),
                "Check process signature and origin".to_string(),
                "Monitor process behavior".to_string(),
            ],
            ThreatType::NetworkAnomaly => vec![
                "Analyze network traffic patterns".to_string(),
                "Check for unauthorized connections".to_string(),
                "Review firewall rules".to_string(),
            ],
            ThreatType::FileSystemAnomaly => vec![
                "Review file access logs".to_string(),
                "Check for unauthorized file modifications".to_string(),
                "Verify file integrity".to_string(),
            ],
            ThreatType::MemoryAnomaly => vec![
                "Monitor memory usage patterns".to_string(),
                "Check for memory leaks".to_string(),
                "Analyze memory dumps".to_string(),
            ],
            ThreatType::BehavioralAnomaly => vec![
                "Review user activity logs".to_string(),
                "Check for unusual behavior patterns".to_string(),
                "Verify user authentication".to_string(),
            ],
            ThreatType::CryptographicAnomaly => vec![
                "Review cryptographic operations".to_string(),
                "Check key usage patterns".to_string(),
                "Verify certificate validity".to_string(),
            ],
            ThreatType::Unknown => vec![
                "Conduct comprehensive system analysis".to_string(),
                "Review all system logs".to_string(),
                "Monitor system behavior closely".to_string(),
            ],
        };
        
        ThreatEvent {
            id: format!("threat_{}", SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_nanos()),
            timestamp: SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_secs(),
            threat_type,
            severity,
            confidence,
            description: description.to_string(),
            source: "ai_threat_detector".to_string(),
            features: features.clone(),
            recommendations,
        }
    }
}

impl Default for AIThreatDetector {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_threat_detection_model() {
        let mut model = ThreatDetectionModel::new(10, 20);
        
        // Create training data
        let mut training_data = Vec::new();
        for _ in 0..100 {
            let features = FeatureVector {
                features: (0..10).map(|_| rand::random::<f64>()).collect(),
                timestamp: 0,
                source: "test".to_string(),
            };
            let target = if features.features[0] > 0.5 { 1.0 } else { 0.0 };
            training_data.push((features, target));
        }
        
        // Train model
        model.train(&training_data).unwrap();
        assert!(model.is_trained());
        
        // Test prediction
        let test_features = FeatureVector {
            features: vec![0.8, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0],
            timestamp: 0,
            source: "test".to_string(),
        };
        
        let prediction = model.predict(&test_features).unwrap();
        assert!(prediction >= 0.0 && prediction <= 1.0);
    }
    
    #[test]
    fn test_ai_threat_detector() {
        let mut detector = AIThreatDetector::new();
        
        // Create test behavior data
        let mut behavior_data = HashMap::new();
        behavior_data.insert("cpu_usage".to_string(), 0.8);
        behavior_data.insert("memory_usage".to_string(), 0.7);
        behavior_data.insert("process_count".to_string(), 150.0);
        behavior_data.insert("network_operations".to_string(), 1000.0);
        
        // Analyze behavior (models not trained yet, should return empty)
        let threats = detector.analyze_behavior(&behavior_data).unwrap();
        assert!(threats.is_empty());
        
        // Train models
        let training_data = vec![(behavior_data.clone(), true)];
        detector.train_models(&training_data).unwrap();
        
        // Analyze again
        let threats = detector.analyze_behavior(&behavior_data).unwrap();
        assert!(!threats.is_empty());
    }
}
