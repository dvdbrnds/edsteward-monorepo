import React, { useState, useEffect, useCallback } from 'react';
import styled from 'styled-components';

const DELIVERY_SERVER = 'http://localhost:3003';

// ─── Styled Components ────────────────────────────────────────────────────────

const Page = styled.div`
  max-width: 1280px;
  margin: 0 auto;
`;

const PageHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
`;

const Title = styled.h1`
  font-size: 28px;
  font-weight: 700;
  color: ${p => p.theme.colors.text};
  display: flex;
  align-items: center;
  gap: 12px;
`;

const ActionBar = styled.div`
  display: flex;
  gap: 12px;
`;

const Btn = styled.button`
  padding: 10px 20px;
  border: none;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all .15s;
  color: white;
  background: ${p => p.$variant === 'danger' ? '#D32F2F' : p.$variant === 'success' ? '#2E7D32' : '#1976D2'};
  opacity: ${p => p.disabled ? 0.5 : 1};
  pointer-events: ${p => p.disabled ? 'none' : 'auto'};
  &:hover { filter: brightness(1.1); }
`;

const StatsGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 16px;
  margin-bottom: 32px;
`;

const StatCard = styled.div`
  background: white;
  border-radius: 12px;
  padding: 20px;
  box-shadow: 0 1px 3px rgba(0,0,0,.1);
  border-left: 4px solid ${p => p.$color || '#1976D2'};
`;

const StatValue = styled.div`
  font-size: 32px;
  font-weight: 700;
  color: ${p => p.theme.colors.text};
`;

const StatLabel = styled.div`
  font-size: 13px;
  color: ${p => p.theme.colors.textSecondary};
  margin-top: 4px;
`;

const Section = styled.section`
  background: white;
  border-radius: 12px;
  box-shadow: 0 1px 3px rgba(0,0,0,.1);
  padding: 24px;
  margin-bottom: 24px;
`;

const SectionTitle = styled.h2`
  font-size: 18px;
  font-weight: 600;
  margin: 0 0 16px;
  color: ${p => p.theme.colors.text};
`;

const Table = styled.table`
  width: 100%;
  border-collapse: collapse;
  font-size: 14px;
`;

const Th = styled.th`
  text-align: left;
  padding: 10px 12px;
  border-bottom: 2px solid ${p => p.theme.colors.divider};
  color: ${p => p.theme.colors.textSecondary};
  font-weight: 600;
  font-size: 12px;
  text-transform: uppercase;
  letter-spacing: .5px;
`;

const Td = styled.td`
  padding: 10px 12px;
  border-bottom: 1px solid ${p => p.theme.colors.divider};
  color: ${p => p.theme.colors.text};
`;

const Badge = styled.span`
  display: inline-block;
  padding: 3px 10px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 600;
  background: ${p => {
    switch (p.$type) {
      case 'major': return '#FFCDD2';
      case 'routine': return '#C8E6C9';
      case 'informational': return '#BBDEFB';
      case 'watch': return '#FFF9C4';
      case 'completed': return '#C8E6C9';
      case 'delivered': return '#C8E6C9';
      case 'running': return '#BBDEFB';
      case 'pending': return '#FFF9C4';
      case 'failed': return '#FFCDD2';
      default: return '#E0E0E0';
    }
  }};
  color: ${p => {
    switch (p.$type) {
      case 'major': case 'failed': return '#B71C1C';
      case 'routine': case 'completed': case 'delivered': return '#1B5E20';
      case 'informational': case 'running': return '#0D47A1';
      case 'watch': case 'pending': return '#F57F17';
      default: return '#424242';
    }
  }};
`;

const EmptyState = styled.div`
  text-align: center;
  padding: 48px 24px;
  color: ${p => p.theme.colors.textSecondary};
  font-size: 15px;
`;

const LogBox = styled.pre`
  background: #1a1a2e;
  color: #a0d0a0;
  padding: 16px;
  border-radius: 8px;
  max-height: 300px;
  overflow-y: auto;
  font-size: 13px;
  line-height: 1.6;
  white-space: pre-wrap;
  word-break: break-word;
`;

const LastScan = styled.div`
  font-size: 13px;
  color: ${p => p.theme.colors.textSecondary};
  margin-top: 4px;
`;

// ─── Component ────────────────────────────────────────────────────────────────

export default function SentinelDashboard() {
  const [stats, setStats] = useState(null);
  const [signals, setSignals] = useState([]);
  const [runs, setRuns] = useState([]);
  const [scanning, setScanning] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [delivering, setDelivering] = useState(false);
  const [logs, setLogs] = useState('');
  const [error, setError] = useState(null);

  const appendLog = useCallback((msg) => {
    setLogs(prev => prev + msg + '\n');
  }, []);

  const fetchDashboard = useCallback(async () => {
    try {
      const [statsRes, signalsRes, runsRes] = await Promise.all([
        fetch(`${DELIVERY_SERVER}/api/sentinel/stats`),
        fetch(`${DELIVERY_SERVER}/api/sentinel/signals?limit=50`),
        fetch(`${DELIVERY_SERVER}/api/sentinel/runs?limit=10`),
      ]);
      if (statsRes.ok) setStats(await statsRes.json());
      if (signalsRes.ok) setSignals(await signalsRes.json());
      if (runsRes.ok) setRuns(await runsRes.json());
      setError(null);
    } catch (err) {
      setError(`Could not reach Sentinel API: ${err.message}`);
    }
  }, []);

  useEffect(() => {
    fetchDashboard();
    const interval = setInterval(fetchDashboard, 15000);
    return () => clearInterval(interval);
  }, [fetchDashboard]);

  const triggerScan = async () => {
    setScanning(true);
    appendLog('[Scan] Starting full source scan...');
    try {
      const res = await fetch(`${DELIVERY_SERVER}/api/sentinel/scan`, { method: 'POST' });
      const data = await res.json();
      appendLog(`[Scan] Complete — ${data.frSignals || 0} FR signals, ${data.ecfrChanges || 0} eCFR changes, ${data.stateActivity || 0} state activity`);
      await fetchDashboard();
    } catch (err) {
      appendLog(`[Scan] Error: ${err.message}`);
    } finally {
      setScanning(false);
    }
  };

  const triggerWorkflows = async () => {
    setProcessing(true);
    appendLog('[Workflow] Processing pending workflows...');
    try {
      const res = await fetch(`${DELIVERY_SERVER}/api/sentinel/process-workflows`, { method: 'POST' });
      const data = await res.json();
      appendLog(`[Workflow] Done — ${data.succeeded || 0} succeeded, ${data.failed || 0} failed`);
      await fetchDashboard();
    } catch (err) {
      appendLog(`[Workflow] Error: ${err.message}`);
    } finally {
      setProcessing(false);
    }
  };

  const triggerDeliveries = async () => {
    setDelivering(true);
    appendLog('[Delivery] Processing pending deliveries...');
    try {
      const res = await fetch(`${DELIVERY_SERVER}/api/sentinel/process-deliveries`, { method: 'POST' });
      const data = await res.json();
      appendLog(`[Delivery] Done — ${data.delivered || 0} delivered, ${data.failed || 0} failed`);
      await fetchDashboard();
    } catch (err) {
      appendLog(`[Delivery] Error: ${err.message}`);
    } finally {
      setDelivering(false);
    }
  };

  const formatDate = (d) => {
    if (!d) return '—';
    return new Date(d).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  return (
    <Page>
      <PageHeader>
        <div>
          <Title>Regulation Sentinel</Title>
          {stats?.last_scan && (
            <LastScan>Last scan: {formatDate(stats.last_scan)}</LastScan>
          )}
        </div>
        <ActionBar>
          <Btn onClick={triggerScan} disabled={scanning}>
            {scanning ? 'Scanning...' : 'Run Full Scan'}
          </Btn>
          <Btn $variant="success" onClick={triggerWorkflows} disabled={processing}>
            {processing ? 'Running...' : 'Process Workflows'}
          </Btn>
          <Btn $variant="danger" onClick={triggerDeliveries} disabled={delivering}>
            {delivering ? 'Delivering...' : 'Deliver Updates'}
          </Btn>
        </ActionBar>
      </PageHeader>

      {error && (
        <Section style={{ borderLeft: '4px solid #D32F2F', background: '#FFF3F3' }}>
          <strong>Connection Error:</strong> {error}
          <div style={{ marginTop: 8, fontSize: 13, color: '#666' }}>
            Make sure the Delivery Server is running on port 3003 and the Sentinel API routes are loaded.
          </div>
        </Section>
      )}

      {/* Stats Grid */}
      <StatsGrid>
        <StatCard $color="#1976D2">
          <StatValue>{stats?.total_runs || 0}</StatValue>
          <StatLabel>Total Scans</StatLabel>
        </StatCard>
        <StatCard $color="#D32F2F">
          <StatValue>{stats?.major_signals || 0}</StatValue>
          <StatLabel>Major Changes</StatLabel>
        </StatCard>
        <StatCard $color="#2E7D32">
          <StatValue>{stats?.routine_signals || 0}</StatValue>
          <StatLabel>Routine Updates</StatLabel>
        </StatCard>
        <StatCard $color="#F57C00">
          <StatValue>{stats?.pending_workflows || 0}</StatValue>
          <StatLabel>Pending Workflows</StatLabel>
        </StatCard>
        <StatCard $color="#7B1FA2">
          <StatValue>{stats?.pending_deliveries || 0}</StatValue>
          <StatLabel>Pending Deliveries</StatLabel>
        </StatCard>
        <StatCard $color="#00838F">
          <StatValue>{stats?.total_delivered || 0}</StatValue>
          <StatLabel>Total Delivered</StatLabel>
        </StatCard>
      </StatsGrid>

      {/* Recent Signals */}
      <Section>
        <SectionTitle>Change Signals</SectionTitle>
        {signals.length === 0 ? (
          <EmptyState>No change signals detected yet. Run a scan to check government sources.</EmptyState>
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Regulation</Th>
                <Th>Classification</Th>
                <Th>Reason</Th>
                <Th>Workflow</Th>
                <Th>Delivery</Th>
                <Th>Detected</Th>
              </tr>
            </thead>
            <tbody>
              {signals.map(sig => (
                <tr key={sig.id}>
                  <Td style={{ fontWeight: 600, maxWidth: 250, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {sig.slug}
                  </Td>
                  <Td><Badge $type={sig.classification}>{sig.classification}</Badge></Td>
                  <Td style={{ maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {sig.reason}
                  </Td>
                  <Td><Badge $type={sig.workflow_status}>{sig.workflow_status}</Badge></Td>
                  <Td><Badge $type={sig.delivery_status}>{sig.delivery_status}</Badge></Td>
                  <Td style={{ whiteSpace: 'nowrap' }}>{formatDate(sig.created_at)}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Section>

      {/* Recent Runs */}
      <Section>
        <SectionTitle>Scan History</SectionTitle>
        {runs.length === 0 ? (
          <EmptyState>No scan runs yet.</EmptyState>
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Run</Th>
                <Th>Type</Th>
                <Th>Status</Th>
                <Th>Scanned</Th>
                <Th>FR Signals</Th>
                <Th>eCFR Changes</Th>
                <Th>State</Th>
                <Th>Errors</Th>
                <Th>Started</Th>
              </tr>
            </thead>
            <tbody>
              {runs.map(run => (
                <tr key={run.id}>
                  <Td>#{run.id}</Td>
                  <Td>{run.scan_type}</Td>
                  <Td><Badge $type={run.status}>{run.status}</Badge></Td>
                  <Td>{run.regs_scanned}</Td>
                  <Td>{run.fr_signals}</Td>
                  <Td>{run.ecfr_changes}</Td>
                  <Td>{run.state_activity}</Td>
                  <Td style={{ color: run.errors > 0 ? '#D32F2F' : 'inherit' }}>{run.errors}</Td>
                  <Td style={{ whiteSpace: 'nowrap' }}>{formatDate(run.started_at)}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Section>

      {/* Activity Log */}
      {logs && (
        <Section>
          <SectionTitle>Activity Log</SectionTitle>
          <LogBox>{logs}</LogBox>
        </Section>
      )}
    </Page>
  );
}
