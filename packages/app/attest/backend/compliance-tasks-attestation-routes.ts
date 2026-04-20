/**
 * POST /api/compliance-tasks/:taskId/request-attestation
 * Create a magic link token and send attestation request email to a field compliance officer
 */
router.post('/:taskId/request-attestation', requireAuth, async (req: Request, res: Response) => {
  try {
    const db = getDbForRequest(req);
    const taskId = parseInt(req.params.taskId);
    const { email, recipientName, personalMessage, expiresInDays = 7 } = req.body;

    if (isNaN(taskId)) {
      return res.status(400).json({ error: 'Invalid task ID' });
    }

    if (!email) {
      return res.status(400).json({ error: 'Email address is required' });
    }

    // Get task with regulation details
    const taskResult = await db.select({
      task: complianceTasks,
      regulation: {
        id: regulations.id,
        name: regulations.name,
      }
    })
    .from(complianceTasks)
    .leftJoin(regulations, eq(complianceTasks.regulationId, regulations.id))
    .where(eq(complianceTasks.id, taskId))
    .limit(1);

    if (taskResult.length === 0) {
      return res.status(404).json({ error: 'Task not found' });
    }

    const { task, regulation } = taskResult[0];

    // Generate secure token
    const token = crypto.randomBytes(32).toString('hex');
    
    // Calculate expiry date
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + expiresInDays);

    // Create token record
    const [tokenRecord] = await db.insert(taskAttestationTokens).values({
      taskId,
      token,
      email,
      recipientName: recipientName || null,
      expiresAt,
      canUploadEvidence: task.evidenceRequired || false,
      canAttest: true,
      createdBy: req.user!.id,
      personalMessage: personalMessage || null,
    }).returning();

    // Update task attestation status to pending
    await db.update(complianceTasks)
      .set({ 
        attestationStatus: 'pending',
        updatedAt: new Date(),
      })
      .where(eq(complianceTasks.id, taskId));

    // Build the attestation URL
    const baseUrl = process.env.APP_URL || `http://${req.headers.host}`;
    const attestationUrl = `${baseUrl}/attest/${token}`;

    // Send email
    const senderName = req.user?.firstName && req.user?.lastName 
      ? `${req.user.firstName} ${req.user.lastName}`
      : req.user?.username || 'Compliance Team';

    const displayName = recipientName || email.split('@')[0];
    const dueDateText = task.dueDate 
      ? `Due Date: ${new Date(task.dueDate).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}`
      : 'No due date specified';

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #1e3a5f 0%, #2c5282 100%); padding: 30px; text-align: center; border-radius: 8px 8px 0 0;">
          <h1 style="color: white; margin: 0; font-size: 24px;">Compliance Attestation Request</h1>
        </div>
        
        <div style="background: #f8f9fa; padding: 30px; border: 1px solid #e9ecef; border-top: none;">
          <p style="margin-top: 0;">Dear ${displayName},</p>
          
          <p>${senderName} is requesting your attestation for the following compliance task:</p>
          
          ${personalMessage ? `<p style="padding: 15px; background: #e3f2fd; border-left: 4px solid #1e88e5; margin: 20px 0;"><em>"${personalMessage}"</em></p>` : ''}
          
          <div style="background: white; border: 1px solid #e9ecef; border-radius: 8px; padding: 20px; margin: 20px 0;">
            <h2 style="margin-top: 0; color: #1e3a5f; font-size: 18px;">${task.title}</h2>
            <p style="color: #666; margin-bottom: 10px;"><strong>Regulation:</strong> ${regulation?.name || 'Unknown'}</p>
            <p style="color: #666; margin-bottom: 10px;"><strong>${dueDateText}</strong></p>
            <p style="color: #666; margin-bottom: 10px;"><strong>Priority:</strong> <span style="text-transform: capitalize;">${task.priority}</span></p>
            ${task.evidenceRequired ? '<p style="color: #b45309; margin-bottom: 10px;">📎 Evidence upload required</p>' : ''}
            ${task.description ? `<p style="color: #666; margin-top: 15px;">${task.description}</p>` : ''}
          </div>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${attestationUrl}" style="display: inline-block; background: #059669; color: white; padding: 14px 28px; text-decoration: none; border-radius: 6px; font-weight: 600;">
              ${task.evidenceRequired ? 'Upload Evidence & Attest' : 'Review & Attest'}
            </a>
          </div>
          
          <p style="font-size: 12px; color: #666;">
            This link will expire on ${expiresAt.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}. 
            If you have questions about this task, please contact your compliance officer.
          </p>
        </div>
        
        <div style="text-align: center; padding: 20px; color: #666; font-size: 12px;">
          <p>EdSteward Compliance Management Platform</p>
        </div>
      </body>
      </html>
    `;

    const emailSent = await emailService.sendEmail(
      email,
      `Attestation Required: ${task.title}`,
      htmlContent,
      { html: true }
    );

    if (!emailSent) {
      console.error(`[Attestation] Email delivery failed for ${email}, but token was created`);
    }

    // Log activity
    await db.insert(taskActivity).values({
      taskId,
      userId: req.user!.id,
      activityType: 'comment',
      content: emailSent 
        ? `Attestation request sent to ${displayName} (${email})`
        : `Attestation request created for ${displayName} (${email}) - email delivery failed`,
    });

    res.json({
      success: true,
      emailDelivered: emailSent,
      message: emailSent 
        ? `Attestation request sent to ${email}`
        : `Attestation link created but email delivery failed. Share the link manually.`,
      token: tokenRecord.id,
      attestationUrl,
      expiresAt,
    });
  } catch (error) {
    console.error('Error requesting attestation:', error);
    res.status(500).json({ error: 'Failed to send attestation request' });
  }
});

/**
 * GET /api/compliance-tasks/attestation/:token
 * Verify attestation token and get task details (public - no auth required)
 */
router.get('/attestation/:token', async (req: Request, res: Response) => {
  try {
    const db = getDbForRequest(req);
    const { token } = req.params;

    // Find valid token
    const tokenResult = await db.select()
      .from(taskAttestationTokens)
      .where(and(
        eq(taskAttestationTokens.token, token),
        gt(taskAttestationTokens.expiresAt, new Date())
      ))
      .limit(1);

    if (tokenResult.length === 0) {
      return res.status(401).json({ 
        error: 'Invalid or expired token',
        code: 'TOKEN_INVALID'
      });
    }

    const attestationToken = tokenResult[0];

    // Check if already used for attestation
    if (attestationToken.usedAt) {
      return res.status(400).json({ 
        error: 'This attestation has already been submitted',
        code: 'ALREADY_ATTESTED',
        attestedAt: attestationToken.usedAt,
      });
    }

    // Get task details with regulation
    const taskResult = await db.select({
      task: complianceTasks,
      regulation: {
        id: regulations.id,
        name: regulations.name,
        topic: regulations.topic,
      }
    })
    .from(complianceTasks)
    .leftJoin(regulations, eq(complianceTasks.regulationId, regulations.id))
    .where(eq(complianceTasks.id, attestationToken.taskId))
    .limit(1);

    if (taskResult.length === 0) {
      return res.status(404).json({ error: 'Task not found' });
    }

    // Get existing evidence for this task
    const evidence = await db.select({
      id: taskEvidence.id,
      fileName: taskEvidence.fileName,
      fileType: taskEvidence.fileType,
      uploadedAt: taskEvidence.uploadedAt,
      description: taskEvidence.description,
    })
    .from(taskEvidence)
    .where(eq(taskEvidence.taskId, attestationToken.taskId))
    .orderBy(desc(taskEvidence.uploadedAt));

    res.json({
      tokenValid: true,
      token: {
        email: attestationToken.email,
        recipientName: attestationToken.recipientName,
        canUploadEvidence: attestationToken.canUploadEvidence,
        canAttest: attestationToken.canAttest,
        expiresAt: attestationToken.expiresAt,
        personalMessage: attestationToken.personalMessage,
      },
      task: {
        ...taskResult[0].task,
        regulation: taskResult[0].regulation,
      },
      existingEvidence: evidence,
    });
  } catch (error) {
    console.error('Error verifying attestation token:', error);
    res.status(500).json({ error: 'Failed to verify token' });
  }
});

/**
 * POST /api/compliance-tasks/attestation/:token/attest
 * Submit attestation for a task (public - no auth required)
 */
router.post('/attestation/:token/attest', async (req: Request, res: Response) => {
  try {
    const db = getDbForRequest(req);
    const { token } = req.params;
    const { signature, notes } = req.body;

    if (!signature) {
      return res.status(400).json({ error: 'Digital signature is required' });
    }

    // Find valid token
    const tokenResult = await db.select()
      .from(taskAttestationTokens)
      .where(and(
        eq(taskAttestationTokens.token, token),
        gt(taskAttestationTokens.expiresAt, new Date())
      ))
      .limit(1);

    if (tokenResult.length === 0) {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }

    const attestationToken = tokenResult[0];

    if (!attestationToken.canAttest) {
      return res.status(403).json({ error: 'This token does not allow attestation' });
    }

    if (attestationToken.usedAt) {
      return res.status(400).json({ error: 'Attestation has already been submitted' });
    }

    // Get task to verify it exists
    const taskResult = await db.select()
      .from(complianceTasks)
      .where(eq(complianceTasks.id, attestationToken.taskId))
      .limit(1);

    if (taskResult.length === 0) {
      return res.status(404).json({ error: 'Task not found' });
    }

    const task = taskResult[0];

    // Check if evidence is required but not uploaded
    if (task.evidenceRequired) {
      const evidenceCount = await db.select({ count: taskEvidence.id })
        .from(taskEvidence)
        .where(eq(taskEvidence.taskId, task.id));
      
      if (!evidenceCount.length || evidenceCount.length === 0) {
        return res.status(400).json({ 
          error: 'Evidence is required before attestation',
          code: 'EVIDENCE_REQUIRED'
        });
      }
    }

    const now = new Date();

    // Create attestation signature with timestamp
    const attesterName = attestationToken.recipientName || attestationToken.email;
    const fullSignature = `${signature}\n\nDigitally attested by ${attesterName} on ${now.toISOString()}`;

    // Try to find a user matching the attestation email
    let completedByUserId: number | null = null;
    const matchingUser = await db.select({ id: users.id })
      .from(users)
      .where(eq(users.email, attestationToken.email))
      .limit(1);
    
    if (matchingUser.length > 0) {
      completedByUserId = matchingUser[0].id;
    }

    // Update task with attestation
    const [updatedTask] = await db.update(complianceTasks)
      .set({
        attestedAt: now,
        attestationSignature: fullSignature,
        attestationNotes: notes || null,
        attestationStatus: 'attested',
        status: 'completed',
        completedAt: now,
        completedBy: completedByUserId, // Set if email matches a user
        updatedAt: now,
      })
      .where(eq(complianceTasks.id, task.id))
      .returning();

    // Mark token as used
    await db.update(taskAttestationTokens)
      .set({ usedAt: now })
      .where(eq(taskAttestationTokens.id, attestationToken.id));

    // Log activity
    await db.insert(taskActivity).values({
      taskId: task.id,
      userId: attestationToken.createdBy || 1, // Use system user if no creator
      activityType: 'status_change',
      content: `Task attested by ${attestationToken.recipientName || attestationToken.email} via magic link`,
      previousValue: task.status,
      newValue: 'completed',
    });

    // Check if all tasks are now completed for this regulation - notify DRI/CCO
    if (task.regulationId) {
      checkAndNotifyRegulationReadyForAttestation(task.regulationId, req.tenantId).catch(err => {
        console.error('[Attestation] Error checking regulation attestation readiness:', err);
      });
    }

    res.json({
      success: true,
      message: 'Attestation submitted successfully',
      task: updatedTask,
      attestedAt: now,
      attestedBy: attestationToken.recipientName || attestationToken.email,
    });
  } catch (error) {
    console.error('Error submitting attestation:', error);
    res.status(500).json({ error: 'Failed to submit attestation' });
  }
});

/**
 * POST /api/compliance-tasks/attestation/:token/evidence
 * Upload evidence via magic link (public - no auth required)
 */
router.post('/attestation/:token/evidence', uploadLimiter, async (req: Request, res: Response) => {
  try {
    const db = getDbForRequest(req);
    const { token } = req.params;

    // Find valid token
    const tokenResult = await db.select()
      .from(taskAttestationTokens)
      .where(and(
        eq(taskAttestationTokens.token, token),
        gt(taskAttestationTokens.expiresAt, new Date())
      ))
      .limit(1);

    if (tokenResult.length === 0) {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }

    const attestationToken = tokenResult[0];

    if (!attestationToken.canUploadEvidence) {
      return res.status(403).json({ error: 'This token does not allow evidence upload' });
    }

    // Get task
    const taskResult = await db.select()
      .from(complianceTasks)
      .where(eq(complianceTasks.id, attestationToken.taskId))
      .limit(1);

    if (taskResult.length === 0) {
      return res.status(404).json({ error: 'Task not found' });
    }

    let fileName = '';
    let fileType = null;
    let fileSize = null;
    let fileUrl = null;
    let linkUrl = null;
    let linkTitle = null;
    let description = '';

    // Check content type
    const contentType = req.headers['content-type'] || '';
    
    if (contentType.includes('multipart/form-data')) {
      // Handle file upload
      const busboy = await import('busboy');
      const bb = busboy.default({ headers: req.headers });
      
      const uploadPromise = new Promise<{
        fileName: string;
        fileType: string;
        fileSize: number;
        fileUrl: string;
        description: string;
        linkUrl?: string;
        linkTitle?: string;
      }>((resolve, reject) => {
        let uploadedFileName = '';
        let uploadedFileType = '';
        let uploadedFileSize = 0;
        let uploadedFileUrl = '';
        let uploadedDescription = '';
        let uploadedLinkUrl = '';
        let uploadedLinkTitle = '';
        const chunks: Buffer[] = [];

        bb.on('field', (name: string, val: string) => {
          if (name === 'description') uploadedDescription = val;
          if (name === 'linkUrl') uploadedLinkUrl = val;
          if (name === 'linkTitle') uploadedLinkTitle = val;
        });

        let fileSavePromise: Promise<void> | null = null;

        bb.on('file', (_name: string, file: import('stream').Readable, info: { filename: string; encoding: string; mimeType: string }) => {
          uploadedFileName = info.filename;
          uploadedFileType = info.mimeType;

          file.on('data', (data: Buffer) => {
            chunks.push(data);
            uploadedFileSize += data.length;
          });

          file.on('end', () => {
            fileSavePromise = (async () => {
              const { getDatabaseStorage } = await import('../../server/services/database');
              const tenantStorage = getDatabaseStorage((req as any).tenantId);
              const fileKey = `evidence-attest-standalone-${Date.now()}-${Math.random().toString(36).substring(7)}`;
              const { url } = await tenantStorage.saveFile(fileKey, Buffer.concat(chunks), uploadedFileType, uploadedFileName);
              uploadedFileUrl = url;
            })();
          });
        });

        bb.on('close', async () => {
          if (fileSavePromise) {
            await fileSavePromise;
          }
          resolve({
            fileName: uploadedFileName || uploadedLinkTitle || 'Link',
            fileType: uploadedFileType,
            fileSize: uploadedFileSize,
            fileUrl: uploadedFileUrl,
            description: uploadedDescription,
            linkUrl: uploadedLinkUrl,
            linkTitle: uploadedLinkTitle,
          });
        });

        bb.on('error', reject);
        req.pipe(bb);
      });

      const uploadData = await uploadPromise;
      fileName = uploadData.fileName;
      fileType = uploadData.fileType || null;
      fileSize = uploadData.fileSize || null;
      fileUrl = uploadData.fileUrl || null;
      linkUrl = uploadData.linkUrl || null;
      linkTitle = uploadData.linkTitle || null;
      description = uploadData.description || '';

    } else {
      // Handle JSON body (for link submissions)
      const body = req.body;
      if (body.linkUrl) {
        linkUrl = body.linkUrl;
        linkTitle = body.linkTitle || body.linkUrl;
        fileName = body.linkTitle || 'Link';
        description = body.description || '';
      } else {
        return res.status(400).json({ error: 'No file or link provided' });
      }
    }

    // Insert evidence record (use token creator as uploader proxy)
    const [newEvidence] = await db.insert(taskEvidence).values({
      taskId: attestationToken.taskId,
      fileName,
      fileType,
      fileSize,
      fileUrl,
      linkUrl,
      linkTitle,
      description: description || `Uploaded via attestation link by ${attestationToken.recipientName || attestationToken.email}`,
      uploadedBy: attestationToken.createdBy || 1, // Use system user if no creator
    }).returning();

    // Log activity
    await db.insert(taskActivity).values({
      taskId: attestationToken.taskId,
      userId: attestationToken.createdBy || 1,
      activityType: 'evidence_uploaded',
      content: `Evidence uploaded via attestation link: ${fileName} (by ${attestationToken.recipientName || attestationToken.email})`,
    });

    res.status(201).json({
      success: true,
      evidence: newEvidence,
      uploadedBy: attestationToken.recipientName || attestationToken.email,
    });
  } catch (error) {
    console.error('Error uploading evidence via attestation:', error);
    res.status(500).json({ error: 'Failed to upload evidence' });
  }
});

/**
 * DELETE /api/compliance-tasks/attestation/:token/evidence/:evidenceId
 * Delete evidence via magic link (public - no auth required)
 */
router.delete('/attestation/:token/evidence/:evidenceId', async (req: Request, res: Response) => {
  try {
    const db = getDbForRequest(req);
    const { token, evidenceId } = req.params;
    const eid = parseInt(evidenceId);

    if (isNaN(eid)) {
      return res.status(400).json({ error: 'Invalid evidence ID' });
    }

    // Find valid token
    const tokenResult = await db.select()
      .from(taskAttestationTokens)
      .where(and(
        eq(taskAttestationTokens.token, token),
        gt(taskAttestationTokens.expiresAt, new Date())
      ))
      .limit(1);

    if (tokenResult.length === 0) {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }

    const attestationToken = tokenResult[0];

    if (!attestationToken.canUploadEvidence) {
      return res.status(403).json({ error: 'This token does not allow evidence management' });
    }

    // Find the evidence and verify it belongs to this token's task
    const existingEvidence = await db.select()
      .from(taskEvidence)
      .where(and(
        eq(taskEvidence.id, eid),
        eq(taskEvidence.taskId, attestationToken.taskId)
      ))
      .limit(1);

    if (existingEvidence.length === 0) {
      return res.status(404).json({ error: 'Evidence not found for this task' });
    }

    // Delete the physical file if it exists
    if (existingEvidence[0].fileUrl) {
      try {
        const fs = await import('fs/promises');
        const path = await import('path');
        const filePath = path.join(process.cwd(), existingEvidence[0].fileUrl);
        await fs.unlink(filePath);
      } catch (e) {
        console.warn('Could not delete evidence file:', e);
      }
    }

    // Delete the evidence record
    await db.delete(taskEvidence).where(eq(taskEvidence.id, eid));

    // Log activity
    await db.insert(taskActivity).values({
      taskId: attestationToken.taskId,
      userId: attestationToken.createdBy || 1,
      activityType: 'comment',
      content: `Evidence removed via attestation link: ${existingEvidence[0].fileName} (by ${attestationToken.recipientName || attestationToken.email})`,
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting evidence via attestation:', error);
    res.status(500).json({ error: 'Failed to delete evidence' });
  }
});
