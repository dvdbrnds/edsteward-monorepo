## EdSteward 15-Minute Demo Script - January 2026

Condensed demo script including MCP Engine regulation delivery demonstration.

### Demo Structure (15 min total)
1. **Dashboard Overview** (2 min) - Stats, compliance posture
2. **MCP Engine Update** (3 min) - ⭐ Show regulation flowing from MCP Engine to EdSteward
3. **Accept/Reject Workflow** (2 min) - Clara accepts the update
4. **Email Attestation** (3 min) - ⭐ Freddy's one-click attestation
5. **Audit Trail** (3 min) - Complete proof chain
6. **Close** (2 min) - Value proposition

### Two "Wow" Moments
1. **MCP Engine → EdSteward**: Regulations monitored automatically, changes flow in real-time
2. **One-Click Attestation**: Field officer attests from email, no login required

### Key Differentiator Message
"We don't just TRACK regulations—we MONITOR them."

### MCP Engine Demo Command
```bash
curl -X POST http://localhost:3051/api/trigger-update \
  -H "Content-Type: application/json" \
  -d '{"regulationId": "clery-act"}'
```

### Click Path
Dashboard → MCP trigger → Refresh → Click pending reg → Accept → Assign Freddy → Email → Click attest → Status History → Dashboard

### Value Props
- CCO: "One person, 355 regulations"
- Audit: "Proof in seconds, not hours"
- Field: "Five seconds, no login"