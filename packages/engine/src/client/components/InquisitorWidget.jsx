import React, { useState } from 'react';
import { Button, Progress, Tag, Spin, Modal, Collapse } from 'antd';
import { RobotOutlined, CheckCircleOutlined, WarningOutlined, CloseCircleOutlined, ThunderboltOutlined } from '@ant-design/icons';
import styled from 'styled-components';

const { Panel } = Collapse;

const WidgetContainer = styled.div`
  margin-top: 12px;
  padding: 12px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(102, 126, 234, 0.2);
`;

const StatusBar = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
  color: white;
`;

const StatusText = styled.div`
  font-size: 0.875rem;
  font-weight: 500;
  display: flex;
  align-items: center;
  gap: 8px;
`;

const ScoreDisplay = styled.div`
  display: flex;
  align-items: center;
  gap: 16px;
  margin-top: 12px;
`;

const ScoreItem = styled.div`
  flex: 1;
  background: rgba(255, 255, 255, 0.95);
  padding: 12px;
  border-radius: 6px;
  text-align: center;
`;

const ScoreLabel = styled.div`
  font-size: 0.75rem;
  color: #6c757d;
  margin-bottom: 4px;
  font-weight: 500;
`;

const ScoreValue = styled.div`
  font-size: 1.5rem;
  font-weight: 700;
  color: ${props => props.color || '#1890ff'};
`;

const AIAnalysisSection = styled.div`
  background: rgba(255, 255, 255, 0.95);
  padding: 12px;
  border-radius: 6px;
  margin-top: 12px;
`;

const AnalysisTitle = styled.div`
  font-size: 0.875rem;
  font-weight: 600;
  color: #1a1a1a;
  margin-bottom: 8px;
  display: flex;
  align-items: center;
  gap: 6px;
`;

const AnalysisText = styled.div`
  font-size: 0.8125rem;
  color: #495057;
  line-height: 1.5;
`;

const AIMetrics = styled.div`
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 8px;
  margin-top: 8px;
`;

const AIMetric = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 0.75rem;
`;

const getScoreColor = (score) => {
  if (score >= 90) return '#10b981';
  if (score >= 75) return '#3b82f6';
  if (score >= 60) return '#f59e0b';
  return '#ef4444';
};

const InquisitorWidget = ({ regulationSlug, regulationName, compact = false }) => {
  const [loading, setLoading] = useState(false);
  const [auditResult, setAuditResult] = useState(null);
  const [error, setError] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [aiProgress, setAiProgress] = useState(0);

  const runAudit = async () => {
    setLoading(true);
    setError(null);
    setAiProgress(0);

    // Simulate AI progress for better UX
    const progressInterval = setInterval(() => {
      setAiProgress(prev => Math.min(prev + 10, 90));
    }, 800);

    try {
      const response = await fetch('http://localhost:3061/api/inquisitor/audit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ regulationSlug }),
        signal: AbortSignal.timeout(60000)
      });

      clearInterval(progressInterval);
      setAiProgress(100);

      if (!response.ok) {
        throw new Error(`Server returned ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();

      if (data.success) {
        setAuditResult(data.audit);
        if (!compact) {
          setShowModal(true);
        }
      } else {
        throw new Error(data.error || 'Audit failed');
      }
    } catch (err) {
      clearInterval(progressInterval);
      setError(err.message);
      console.error('Audit error:', err);
    } finally {
      setLoading(false);
      setTimeout(() => setAiProgress(0), 1000);
    }
  };

  const renderCompactView = () => {
    if (!auditResult) return null;

    return (
      <ScoreDisplay>
        <ScoreItem>
          <ScoreLabel>Overall</ScoreLabel>
          <ScoreValue color={getScoreColor(auditResult.overallScore)}>
            {auditResult.overallScore}
          </ScoreValue>
        </ScoreItem>
        <ScoreItem>
          <ScoreLabel>Certainty</ScoreLabel>
          <ScoreValue color={getScoreColor(auditResult.overallScore)}>
            {auditResult.certaintyLevel}
          </ScoreValue>
        </ScoreItem>
      </ScoreDisplay>
    );
  };

  const renderFullView = () => {
    if (!auditResult) return null;

    return (
      <>
        <ScoreDisplay>
          <ScoreItem>
            <ScoreLabel>Content</ScoreLabel>
            <ScoreValue color={getScoreColor(auditResult.scores?.content || 0)}>
              {auditResult.scores?.content || 0}
            </ScoreValue>
          </ScoreItem>
          <ScoreItem>
            <ScoreLabel>Summary</ScoreLabel>
            <ScoreValue color={getScoreColor(auditResult.scores?.summary || 0)}>
              {auditResult.scores?.summary || 0}
            </ScoreValue>
          </ScoreItem>
          <ScoreItem>
            <ScoreLabel>Requirements</ScoreLabel>
            <ScoreValue color={getScoreColor(auditResult.scores?.requirements || 0)}>
              {auditResult.scores?.requirements || 0}
            </ScoreValue>
          </ScoreItem>
          <ScoreItem>
            <ScoreLabel>Deadlines</ScoreLabel>
            <ScoreValue color={getScoreColor(auditResult.scores?.deadlines || 0)}>
              {auditResult.scores?.deadlines || 0}
            </ScoreValue>
          </ScoreItem>
        </ScoreDisplay>

        {auditResult.aiAnalysis?.enabled && (
          <AIAnalysisSection>
            <AnalysisTitle>
              <RobotOutlined /> AI Semantic Analysis
              <Tag color="purple" style={{ marginLeft: 'auto' }}>
                {auditResult.aiAnalysis.model}
              </Tag>
            </AnalysisTitle>
            
            <AIMetrics>
              <AIMetric>
                <span>Legal Accuracy:</span>
                <strong style={{ color: getScoreColor(auditResult.aiAnalysis.legalAccuracy?.score || 0) }}>
                  {auditResult.aiAnalysis.legalAccuracy?.score || 0}/100
                </strong>
              </AIMetric>
              <AIMetric>
                <span>Completeness:</span>
                <strong style={{ color: getScoreColor(auditResult.aiAnalysis.completeness?.score || 0) }}>
                  {auditResult.aiAnalysis.completeness?.score || 0}/100
                </strong>
              </AIMetric>
              <AIMetric>
                <span>Clarity:</span>
                <strong style={{ color: getScoreColor(auditResult.aiAnalysis.clarity?.score || 0) }}>
                  {auditResult.aiAnalysis.clarity?.score || 0}/100
                </strong>
              </AIMetric>
              <AIMetric>
                <span>Actionability:</span>
                <strong style={{ color: getScoreColor(auditResult.aiAnalysis.actionability?.score || 0) }}>
                  {auditResult.aiAnalysis.actionability?.score || 0}/100
                </strong>
              </AIMetric>
            </AIMetrics>

            {auditResult.aiAnalysis.overallAssessment && (
              <AnalysisText style={{ marginTop: 12, padding: '12px', background: '#f8f9fa', borderRadius: 4 }}>
                <strong>AI Assessment:</strong> {auditResult.aiAnalysis.overallAssessment}
              </AnalysisText>
            )}
          </AIAnalysisSection>
        )}
      </>
    );
  };

  return (
    <>
      <WidgetContainer>
        <StatusBar>
          <StatusText>
            <RobotOutlined />
            AI Quality Auditor
          </StatusText>
          <Button
            type="primary"
            size="small"
            icon={<ThunderboltOutlined />}
            onClick={runAudit}
            loading={loading}
            style={{
              background: 'rgba(255, 255, 255, 0.2)',
              border: '1px solid rgba(255, 255, 255, 0.3)',
              backdropFilter: 'blur(10px)'
            }}
          >
            {loading ? 'Analyzing...' : 'Run Audit'}
          </Button>
        </StatusBar>

        {loading && (
          <div style={{ background: 'rgba(255, 255, 255, 0.95)', padding: '16px', borderRadius: '6px' }}>
            <Spin size="small" style={{ marginRight: 8 }} />
            <span style={{ fontSize: '0.875rem', color: '#495057' }}>
              AI analyzing regulation quality...
            </span>
            <Progress 
              percent={aiProgress} 
              strokeColor="#667eea" 
              showInfo={false}
              style={{ marginTop: 8 }}
            />
          </div>
        )}

        {error && (
          <div style={{ background: '#fee', padding: '12px', borderRadius: '6px', marginTop: 8 }}>
            <CloseCircleOutlined style={{ color: '#dc2626', marginRight: 6 }} />
            <span style={{ fontSize: '0.875rem', color: '#dc2626' }}>
              {error}
            </span>
          </div>
        )}

        {compact ? renderCompactView() : renderFullView()}
      </WidgetContainer>

      <Modal
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <RobotOutlined style={{ color: '#667eea' }} />
            Quality Audit: {regulationName}
          </div>
        }
        open={showModal}
        onCancel={() => setShowModal(false)}
        width={800}
        footer={null}
      >
        {auditResult && renderFullView()}
      </Modal>
    </>
  );
};

export default InquisitorWidget;

