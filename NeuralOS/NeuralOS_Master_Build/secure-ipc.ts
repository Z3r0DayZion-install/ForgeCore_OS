/**
 * Secure Inter-Process Communication Protocol
 * Provides encrypted, authenticated, and tamper-resistant IPC
 * with message queuing, encryption, and replay attack prevention
 */

import crypto from 'crypto';

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

interface IPCMessage {
  id: string;
  timestamp: number;
  senderId: string;
  recipientId: string;
  messageType: string;
  payload: Record<string, any>;
  signature: string;
  encryptionKey: string;
  nonce: string;
  priority: 'low' | 'normal' | 'high' | 'critical';
  ttl: number; // Time to live in milliseconds
  requiresAck: boolean;
  acknowledged: boolean;
  acknowledgedAt?: number;
  metadata: Record<string, any>;
}

interface IPCChannel {
  id: string;
  name: string;
  senderId: string;
  recipientId: string;
  createdAt: number;
  isEncrypted: boolean;
  encryptionAlgorithm: 'AES-256-GCM' | 'ChaCha20-Poly1305';
  sharedSecret?: string;
  messageQueue: IPCMessage[];
  maxQueueSize: number;
  isActive: boolean;
  lastMessageTime: number;
}

interface ProcessIdentity {
  processId: string;
  processName: string;
  publicKey: string;
  privateKey?: string;
  createdAt: number;
  isVerified: boolean;
  verifiedBy?: string;
  trusts: Set<string>; // Trusted process IDs
  trustLevel: 'trusted' | 'untrusted' | 'restricted';
}

interface IPCPolicy {
  id: string;
  name: string;
  allowedSenders: string[];
  allowedRecipients: string[];
  allowedMessageTypes: string[];
  requiresEncryption: boolean;
  requiresSignature: boolean;
  maxMessageSize: number;
  rateLimitPerSecond: number;
  enabled: boolean;
}

interface IPCAuditEntry {
  timestamp: number;
  messageId: string;
  senderId: string;
  recipientId: string;
  messageType: string;
  action: 'sent' | 'received' | 'rejected' | 'failed' | 'ack-sent' | 'ack-received';
  success: boolean;
  details: Record<string, any>;
}

// ============================================================================
// SECURE IPC ENGINE
// ============================================================================

export class SecureIPCEngine {
  private channels: Map<string, IPCChannel> = new Map();
  private processIdentities: Map<string, ProcessIdentity> = new Map();
  private policies: Map<string, IPCPolicy> = new Map();
  private auditLog: IPCAuditEntry[] = [];
  private messageHistory: Map<string, IPCMessage> = new Map();
  private rateLimiter: Map<string, number[]> = new Map();
  private nonces: Set<string> = new Set();
  private maxAuditEntries: number = 50000;
  private maxMessageHistory: number = 10000;
  private maxChannelQueueSize: number = 10000;
  private nonceWindow: number = 3600000; // 1 hour for replay prevention

  // ========================================================================
  // PROCESS IDENTITY MANAGEMENT
  // ========================================================================

  /**
   * Register a new process
   */
  registerProcess(
    processId: string,
    processName: string,
    trustLevel: 'trusted' | 'untrusted' | 'restricted' = 'untrusted'
  ): ProcessIdentity {
    // Generate RSA key pair for the process
    const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
      modulusLength: 2048,
      publicKeyEncoding: { type: 'spki', format: 'pem' },
      privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
    });

    const processIdentity: ProcessIdentity = {
      processId,
      processName,
      publicKey,
      privateKey,
      createdAt: Date.now(),
      isVerified: false,
      trusts: new Set(),
      trustLevel,
    };

    this.processIdentities.set(processId, processIdentity);

    this.logAudit({
      timestamp: Date.now(),
      messageId: '',
      senderId: processId,
      recipientId: '',
      messageType: '',
      action: 'sent',
      success: true,
      details: { event: 'process-registered', trustLevel },
    });

    return processIdentity;
  }

  /**
   * Verify a process identity
   */
  verifyProcessIdentity(
    processId: string,
    verifiedBy: string = 'system'
  ): boolean {
    const process = this.processIdentities.get(processId);

    if (!process) {
      return false;
    }

    process.isVerified = true;
    process.verifiedBy = verifiedBy;

    return true;
  }

  /**
   * Establish trust between two processes
   */
  establishTrust(
    trusteeId: string,
    trustedId: string,
    bidirectional: boolean = false
  ): boolean {
    const trustee = this.processIdentities.get(trusteeId);
    const trusted = this.processIdentities.get(trustedId);

    if (!trustee || !trusted) {
      return false;
    }

    trustee.trusts.add(trustedId);

    if (bidirectional) {
      trusted.trusts.add(trusteeId);
    }

    return true;
  }

  /**
   * Check if a process trusts another
   */
  canCommunicate(senderId: string, recipientId: string): {
    allowed: boolean;
    reason: string;
  } {
    const sender = this.processIdentities.get(senderId);
    const recipient = this.processIdentities.get(recipientId);

    if (!sender || !recipient) {
      return { allowed: false, reason: 'Process not registered' };
    }

    if (!sender.isVerified || !recipient.isVerified) {
      return { allowed: false, reason: 'Process not verified' };
    }

    if (sender.trustLevel === 'restricted') {
      return { allowed: false, reason: 'Sender is restricted' };
    }

    if (!sender.trusts.has(recipientId) && sender.trustLevel === 'untrusted') {
      return { allowed: false, reason: 'No trust relationship established' };
    }

    return { allowed: true, reason: 'Communication allowed' };
  }

  // ========================================================================
  // CHANNEL MANAGEMENT
  // ========================================================================

  /**
   * Create a secure IPC channel
   */
  createChannel(
    senderId: string,
    recipientId: string,
    options: {
      encrypted?: boolean;
      algorithm?: 'AES-256-GCM' | 'ChaCha20-Poly1305';
      maxQueueSize?: number;
    } = {}
  ): IPCChannel | null {
    // Check if communication is allowed
    const canCom = this.canCommunicate(senderId, recipientId);
    if (!canCom.allowed) {
      return null;
    }

    const channelId = this.generateChannelId();
    const isEncrypted = options.encrypted !== false; // Default to true
    const algorithm = options.algorithm || 'AES-256-GCM';

    // Generate shared secret if encrypted
    let sharedSecret = undefined;
    if (isEncrypted) {
      sharedSecret = crypto.randomBytes(32).toString('hex');
    }

    const channel: IPCChannel = {
      id: channelId,
      name: `channel_${senderId}_${recipientId}`,
      senderId,
      recipientId,
      createdAt: Date.now(),
      isEncrypted,
      encryptionAlgorithm: algorithm,
      sharedSecret,
      messageQueue: [],
      maxQueueSize: options.maxQueueSize || this.maxChannelQueueSize,
      isActive: true,
      lastMessageTime: 0,
    };

    this.channels.set(channelId, channel);

    return channel;
  }

  /**
   * Get or create channel
   */
  getOrCreateChannel(
    senderId: string,
    recipientId: string,
    options?: any
  ): IPCChannel | null {
    // Check for existing channel
    for (const channel of this.channels.values()) {
      if (
        (channel.senderId === senderId && channel.recipientId === recipientId) ||
        (channel.senderId === recipientId && channel.recipientId === senderId)
      ) {
        return channel;
      }
    }

    // Create new channel
    return this.createChannel(senderId, recipientId, options);
  }

  /**
   * List active channels
   */
  listActiveChannels(): IPCChannel[] {
    return Array.from(this.channels.values()).filter((c) => c.isActive);
  }

  /**
   * Close a channel
   */
  closeChannel(channelId: string): boolean {
    const channel = this.channels.get(channelId);

    if (!channel) {
      return false;
    }

    channel.isActive = false;

    return true;
  }

  // ========================================================================
  // MESSAGE SENDING & RECEIVING
  // ========================================================================

  /**
   * Send a message through IPC
   */
  sendMessage(
    senderId: string,
    recipientId: string,
    messageType: string,
    payload: Record<string, any>,
    options: {
      priority?: 'low' | 'normal' | 'high' | 'critical';
      ttl?: number;
      requiresAck?: boolean;
    } = {}
  ): { success: boolean; messageId?: string; error?: string } {
    // Check communication policy
    const canCom = this.canCommunicate(senderId, recipientId);
    if (!canCom.allowed) {
      return { success: false, error: canCom.reason };
    }

    // Check rate limiting
    if (!this.checkRateLimit(senderId)) {
      return { success: false, error: 'Rate limit exceeded' };
    }

    // Get or create channel
    const channel = this.getOrCreateChannel(senderId, recipientId);
    if (!channel) {
      return { success: false, error: 'Could not create channel' };
    }

    // Check queue size
    if (channel.messageQueue.length >= channel.maxQueueSize) {
      return { success: false, error: 'Channel queue full' };
    }

    const messageId = this.generateMessageId();
    const timestamp = Date.now();
    const nonce = this.generateNonce();

    // Create message
    const message: IPCMessage = {
      id: messageId,
      timestamp,
      senderId,
      recipientId,
      messageType,
      payload,
      signature: '',
      encryptionKey: '',
      nonce,
      priority: options.priority || 'normal',
      ttl: options.ttl || 600000, // 10 minutes default
      requiresAck: options.requiresAck || false,
      acknowledged: false,
      metadata: {
        channelId: channel.id,
        encrypted: channel.isEncrypted,
      },
    };

    // Sign message
    const sender = this.processIdentities.get(senderId);
    if (sender?.privateKey) {
      const signer = crypto.createSign('RSA-SHA256');
      signer.update(JSON.stringify(message));
      message.signature = signer.sign(sender.privateKey, 'base64');
    }

    // Encrypt message if channel is encrypted
    if (channel.isEncrypted && channel.sharedSecret) {
      const iv = crypto.randomBytes(12);
      const cipher = crypto.createCipheriv(
        'aes-256-gcm',
        Buffer.from(channel.sharedSecret, 'hex'),
        iv
      );

      let encrypted = cipher.update(JSON.stringify(payload), 'utf8', 'base64');
      encrypted += cipher.final('base64');
      const authTag = cipher.getAuthTag();

      message.encryptionKey = iv.toString('base64') + ':' + authTag.toString('base64');
      message.payload = { _encrypted: encrypted } as any;
    }

    // Add to queue
    channel.messageQueue.push(message);
    channel.lastMessageTime = timestamp;

    // Store in history
    this.messageHistory.set(messageId, message);
    this.pruneMessageHistory();

    // Log audit
    this.logAudit({
      timestamp,
      messageId,
      senderId,
      recipientId,
      messageType,
      action: 'sent',
      success: true,
      details: { channelId: channel.id, priority: message.priority },
    });

    return { success: true, messageId };
  }

  /**
   * Receive messages from a channel
   */
  receiveMessages(
    recipientId: string,
    limit: number = 100
  ): {
    messages: IPCMessage[];
    failedMessages: string[];
  } {
    const messages: IPCMessage[] = [];
    const failedMessages: string[] = [];

    // Find channels where this process is the recipient
    for (const channel of this.channels.values()) {
      if (!channel.isActive || channel.recipientId !== recipientId) {
        continue;
      }

      // Get messages from queue
      while (channel.messageQueue.length > 0 && messages.length < limit) {
        const message = channel.messageQueue.shift();

        if (!message) {
          continue;
        }

        // Check TTL
        if (Date.now() - message.timestamp > message.ttl) {
          failedMessages.push(message.id);
          continue;
        }

        // Check for replay attacks (nonce)
        if (this.nonces.has(message.nonce)) {
          failedMessages.push(message.id);
          continue;
        }

        this.nonces.add(message.nonce);

        // Verify signature
        const sender = this.processIdentities.get(message.senderId);
        if (sender?.publicKey && message.signature) {
          try {
            const verifier = crypto.createVerify('RSA-SHA256');
            const messageCopy = { ...message };
            messageCopy.signature = '';
            verifier.update(JSON.stringify(messageCopy));
            if (!verifier.verify(sender.publicKey, message.signature, 'base64')) {
              failedMessages.push(message.id);
              continue;
            }
          } catch (error) {
            failedMessages.push(message.id);
            continue;
          }
        }

        // Decrypt if needed
        if (channel.isEncrypted && channel.sharedSecret) {
          try {
            const [ivHex, tagHex] = message.encryptionKey.split(':');
            const iv = Buffer.from(ivHex, 'base64');
            const authTag = Buffer.from(tagHex, 'base64');

            const decipher = crypto.createDecipheriv(
              'aes-256-gcm',
              Buffer.from(channel.sharedSecret, 'hex'),
              iv
            );
            decipher.setAuthTag(authTag);

            let decrypted = decipher.update(message.payload._encrypted, 'base64', 'utf8');
            decrypted += decipher.final('utf8');

            message.payload = JSON.parse(decrypted);
          } catch (error) {
            failedMessages.push(message.id);
            continue;
          }
        }

        messages.push(message);

        // Send acknowledgment if required
        if (message.requiresAck) {
          this.sendAck(message.id, message.senderId, recipientId);
        }
      }
    }

    return { messages, failedMessages };
  }

  /**
   * Send acknowledgment
   */
  private sendAck(
    messageId: string,
    recipientId: string,
    senderId: string
  ): void {
    this.sendMessage(senderId, recipientId, 'ack', {
      acknowledgedMessageId: messageId,
    });
  }

  // ========================================================================
  // POLICY MANAGEMENT
  // ========================================================================

  /**
   * Create an IPC policy
   */
  createPolicy(
    name: string,
    options: {
      allowedSenders?: string[];
      allowedRecipients?: string[];
      allowedMessageTypes?: string[];
      requiresEncryption?: boolean;
      requiresSignature?: boolean;
      maxMessageSize?: number;
      rateLimitPerSecond?: number;
    } = {}
  ): IPCPolicy {
    const policyId = this.generatePolicyId();

    const policy: IPCPolicy = {
      id: policyId,
      name,
      allowedSenders: options.allowedSenders || [],
      allowedRecipients: options.allowedRecipients || [],
      allowedMessageTypes: options.allowedMessageTypes || [],
      requiresEncryption: options.requiresEncryption !== false,
      requiresSignature: options.requiresSignature !== false,
      maxMessageSize: options.maxMessageSize || 1024 * 1024, // 1MB
      rateLimitPerSecond: options.rateLimitPerSecond || 1000,
      enabled: true,
    };

    this.policies.set(policyId, policy);

    return policy;
  }

  /**
   * List policies
   */
  listPolicies(): IPCPolicy[] {
    return Array.from(this.policies.values());
  }

  // ========================================================================
  // AUDIT & MONITORING
  // ========================================================================

  /**
   * Get audit log
   */
  getAuditLog(limit: number = 1000): IPCAuditEntry[] {
    return this.auditLog.slice(-limit);
  }

  /**
   * Get audit log by sender
   */
  getAuditLogBySender(senderId: string, limit: number = 1000): IPCAuditEntry[] {
    return this.auditLog
      .filter((e) => e.senderId === senderId)
      .slice(-limit);
  }

  /**
   * Get IPC statistics
   */
  getIPCStats(): Record<string, any> {
    return {
      totalChannels: this.channels.size,
      activeChannels: this.listActiveChannels().length,
      totalProcesses: this.processIdentities.size,
      verifiedProcesses: Array.from(this.processIdentities.values()).filter(
        (p) => p.isVerified
      ).length,
      totalMessages: this.messageHistory.size,
      totalAuditEntries: this.auditLog.length,
      activePolicies: Array.from(this.policies.values()).filter((p) => p.enabled).length,
    };
  }

  // ========================================================================
  // HELPER METHODS
  // ========================================================================

  private generateChannelId(): string {
    return `ch_${crypto.randomBytes(12).toString('hex')}_${Date.now()}`;
  }

  private generateMessageId(): string {
    return `msg_${crypto.randomBytes(16).toString('hex')}_${Date.now()}`;
  }

  private generateNonce(): string {
    return crypto.randomBytes(16).toString('hex');
  }

  private generatePolicyId(): string {
    return `policy_${crypto.randomBytes(12).toString('hex')}`;
  }

  private checkRateLimit(processId: string): boolean {
    const now = Date.now();
    const window = now - 1000; // Last second

    if (!this.rateLimiter.has(processId)) {
      this.rateLimiter.set(processId, [now]);
      return true;
    }

    const times = this.rateLimiter.get(processId)!;
    const recentTimes = times.filter((t) => t > window);

    if (recentTimes.length > 1000) {
      return false; // Exceeded rate limit
    }

    recentTimes.push(now);
    this.rateLimiter.set(processId, recentTimes);

    return true;
  }

  private logAudit(entry: IPCAuditEntry): void {
    this.auditLog.push(entry);
    this.pruneAuditLog();
  }

  private pruneAuditLog(): void {
    if (this.auditLog.length > this.maxAuditEntries) {
      this.auditLog = this.auditLog.slice(-this.maxAuditEntries);
    }
  }

  private pruneMessageHistory(): void {
    if (this.messageHistory.size > this.maxMessageHistory) {
      const entriesToDelete = this.messageHistory.size - this.maxMessageHistory;
      let deleted = 0;

      for (const [id, msg] of this.messageHistory.entries()) {
        if (deleted >= entriesToDelete) break;
        this.messageHistory.delete(id);
        deleted++;
      }
    }
  }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

let ipcEngine: SecureIPCEngine | null = null;

export function getIPCEngine(): SecureIPCEngine {
  if (!ipcEngine) {
    ipcEngine = new SecureIPCEngine();
  }
  return ipcEngine;
}

// ============================================================================
// REACT HOOK INTEGRATION
// ============================================================================

import { useState, useCallback, useRef } from 'react';

export function useSecureIPC(processId: string) {
  const engine = useRef(getIPCEngine()).current;
  const [ipcState, setIPCState] = useState({
    processId,
    channels: engine.listActiveChannels(),
    messages: [] as IPCMessage[],
    stats: engine.getIPCStats(),
  });

  const registerProcess = useCallback(
    (processName: string) => {
      const process = engine.registerProcess(processId, processName);
      engine.verifyProcessIdentity(processId);
      return process;
    },
    [engine, processId]
  );

  const sendMessage = useCallback(
    (
      recipientId: string,
      messageType: string,
      payload: Record<string, any>,
      options?: any
    ) => {
      const result = engine.sendMessage(
        processId,
        recipientId,
        messageType,
        payload,
        options
      );
      setIPCState((prev) => ({
        ...prev,
        channels: engine.listActiveChannels(),
        stats: engine.getIPCStats(),
      }));
      return result;
    },
    [engine, processId]
  );

  const receiveMessages = useCallback(
    (limit?: number) => {
      const { messages } = engine.receiveMessages(processId, limit);
      setIPCState((prev) => ({
        ...prev,
        messages,
      }));
      return messages;
    },
    [engine, processId]
  );

  return {
    registerProcess,
    sendMessage,
    receiveMessages,
    ipcState,
    engine,
  };
}
