import React, { useState } from 'react';
import styled from 'styled-components';
import { Button, Card, Spin, Alert, Progress, Tabs, Select, Badge, Tag } from 'antd';
import { CheckCircleOutlined, CloseCircleOutlined, WarningOutlined, RobotOutlined, FileSearchOutlined } from '@ant-design/icons';

const { TabPane } = Tabs;
const { Option } = Select;

// Styled Components
const PanelContainer = styled.div`
  background: #ffffff;
  border-radius: 8px;
  padding: 24px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
`;

const PanelHeader = styled.div`
  margin-bottom: 24px;
`;

const PanelTitle = styled.h2`
  margin: 0 0 8px 0;
  font-size: 1.5rem;
  font-weight: 700;
  color: #1a365d;
  display: flex;
  align-items: center;
  gap: 12px;
`;

const PanelSubtitle = styled.p`
  margin: 0;
  color: #6c757d;
  font-size: 0.95rem;
`;

const ControlSection = styled.div`
  display: flex;
  gap: 16px;
  margin-bottom: 24px;
  flex-wrap: wrap;
  align-items: center;
`;

const StyledSelect = styled(Select)`
  min-width: 300px;
  
  .ant-select-selector {
    border-radius: 6px !important;
    height: 40px !important;
    display: flex;
    align-items: center;
  }
`;

const AuditButton = styled(Button)`
  height: 40px;
  border-radius: 6px;
  font-weight: 600;
  padding: 0 24px;
  
  &.single-audit {
    background: #1976d2;
    border-color: #1976d2;
    
    &:hover {
      background: #1565c0;
      border-color: #1565c0;
    }
  }
  
  &.batch-audit {
    background: #7c3aed;
    border-color: #7c3aed;
    
    &:hover {
      background: #6d28d9;
      border-color: #6d28d9;
    }
  }
`;

const ResultsContainer = styled.div`
  margin-top: 24px;
`;

const ScoreCard = styled(Card)`
  margin-bottom: 16px;
  border-radius: 8px;
  
  &.score-excellent {
    border-left: 4px solid #10b981;
  }
  
  &.score-good {
    border-left: 4px solid #3b82f6;
  }
  
  &.score-fair {
    border-left: 4px solid #f59e0b;
  }
  
  &.score-poor {
    border-left: 4px solid #ef4444;
  }
`;

const ScoreHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
`;

const ScoreBadge = styled.div`
  font-size: 2.5rem;
  font-weight: 700;
  color: ${props => props.color};
`;

const CertaintyBadge = styled(Tag)`
  font-size: 0.875rem;
  padding: 4px 12px;
  border-radius: 12px;
`;

const MetricsGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 16px;
  margin-bottom: 20px;
`;

const MetricItem = styled.div`
  padding: 12px;
  background: #f8f9fa;
  border-radius: 6px;
  border-left: 3px solid ${props => props.color};
`;

const MetricLabel = styled.div`
  font-size: 0.875rem;
  color: #6c757d;
  margin-bottom: 4px;
`;

const MetricValue = styled.div`
  font-size: 1.25rem;
  font-weight: 600;
  color: #1a1a1a;
`;

const AISection = styled.div`
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  padding: 20px;
  border-radius: 8px;
  margin-bottom: 16px;
`;

const AISectionHeader = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 16px;
  font-size: 1.125rem;
  font-weight: 600;
`;

const AIMetricsGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 12px;
  margin-bottom: 16px;
`;

const AIMetricCard = styled.div`
  background: rgba(255, 255, 255, 0.15);
  padding: 12px;
  border-radius: 6px;
  backdrop-filter: blur(10px);
`;

const AIMetricLabel = styled.div`
  font-size: 0.875rem;
  opacity: 0.9;
  margin-bottom: 4px;
`;

const AIMetricScore = styled.div`
  font-size: 1.5rem;
  font-weight: 700;
`;

const AIAssessment = styled.div`
  background: rgba(255, 255, 255, 0.1);
  padding: 16px;
  border-radius: 6px;
  font-size: 0.95rem;
  line-height: 1.6;
  backdrop-filter: blur(10px);
`;

const IssuesList = styled.div`
  margin-top: 16px;
`;

const IssueItem = styled.div`
  padding: 12px;
  background: ${props => props.type === 'error' ? '#fef2f2' : props.type === 'warning' ? '#fffbeb' : '#f0fdf4'};
  border-left: 3px solid ${props => props.type === 'error' ? '#ef4444' : props.type === 'warning' ? '#f59e0b' : '#10b981'};
  border-radius: 4px;
  margin-bottom: 8px;
  font-size: 0.9rem;
`;

const BatchResultsGrid = styled.div`
  display: grid;
  gap: 16px;
`;

const BatchResultCard = styled.div`
  padding: 16px;
  background: white;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s ease;
  
  &:hover {
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
    border-color: #1976d2;
  }
`;

const BatchResultHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
`;

const RegulationName = styled.div`
  font-weight: 600;
  color: #1a1a1a;
  font-size: 1rem;
`;

const BatchScoreBadge = styled.div`
  font-size: 1.5rem;
  font-weight: 700;
  color: ${props => props.color};
`;

const StatusIcon = styled.span`
  margin-right: 8px;
`;

// Demo regulations list
const DEMO_REGULATIONS = [
  { slug: 'ferpa', name: 'FERPA - Family Educational Rights and Privacy Act' },
  { slug: 'title-ix', name: 'Title IX - Education Amendments of 1972' },
  { slug: 'ada', name: 'ADA - Americans with Disabilities Act' },
  { slug: 'title-iv', name: 'Title IV - Student Financial Aid Programs' },
  { slug: 'section-504', name: 'Section 504 - Rehabilitation Act' },
  { slug: 'title-vi', name: 'Title VI - Civil Rights Act' },
  { slug: 'heoa', name: 'HEOA - Higher Education Opportunity Act' },
  { slug: 'drug-free-schools', name: 'Drug-Free Schools and Communities Act' },
  { slug: 'teach-act', name: 'TEACH Act - Technology, Education and Copyright' },
  { slug: 'clery-act', name: 'Clery Act - Campus Security Policy' }
];

const InquisitorPanel = () => {
  const [selectedRegulation, setSelectedRegulation] = useState(null);
  const [auditLoading, setAuditLoading] = useState(false);
  const [batchLoading, setBatchLoading] = useState(false);
  const [auditResult, setAuditResult] = useState(null);
  const [batchResults, setBatchResults] = useState(null);
  const [error, setError] = useState(null);

  const handleSingleAudit = async () => {
    if (!selectedRegulation) {
      setError('Please select a regulation to audit');
      return;
    }

    setAuditLoading(true);
    setError(null);
    setAuditResult(null);

    try {
      // Add 60 second timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 60000);

      const response = await fetch('http://localhost:3061/api/inquisitor/audit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ regulationSlug: selectedRegulation }),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`Server returned ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Audit failed');
      }

      setAuditResult(data.audit);
    } catch (err) {
      if (err.name === 'AbortError') {
        setError('Audit timed out after 60 seconds. The server may be overloaded or the regulation data is unavailable.');
      } else {
        setError(`Audit failed: ${err.message}`);
      }
      console.error('Audit error:', err);
    } finally {
      setAuditLoading(false);
    }
  };

  const handleBatchAudit = async () => {
    setBatchLoading(true);
    setError(null);
    setBatchResults(null);

    try {
      const results = [];

      for (const regulation of DEMO_REGULATIONS) {
        const response = await fetch('http://localhost:3061/api/inquisitor/audit', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ regulationSlug: regulation.slug })
        });

        const data = await response.json();

        if (data.success) {
          results.push({
            ...regulation,
            audit: data.audit
          });
        }

        // Small delay between requests
        await new Promise(resolve => setTimeout(resolve, 500));
      }

      setBatchResults(results);
    } catch (err) {
      setError(err.message);
    } finally {
      setBatchLoading(false);
    }
  };

  const getScoreColor = (score) => {
    if (score >= 90) return '#10b981';
    if (score >= 75) return '#3b82f6';
    if (score >= 60) return '#f59e0b';
    return '#ef4444';
  };

  const getScoreClass = (score) => {
    if (score >= 90) return 'score-excellent';
    if (score >= 75) return 'score-good';
    if (score >= 60) return 'score-fair';
    return 'score-poor';
  };

  const getCertaintyColor = (certainty) => {
    const colors = {
      'A': '#10b981',
      'B': '#3b82f6',
      'C': '#f59e0b',
      'D': '#ef4444',
      'F': '#dc2626'
    };
    return colors[certainty] || '#6c757d';
  };

  return (
    <PanelContainer>
      <PanelHeader>
        <PanelTitle>
          <RobotOutlined style={{ fontSize: '1.75rem' }} />
          Inquisitor AI - Regulation Quality Auditor
        </PanelTitle>
        <PanelSubtitle>
          AI-powered semantic validation and quality assessment for regulation data
        </PanelSubtitle>
      </PanelHeader>

      <Tabs defaultActiveKey="single">
        <TabPane tab="Single Regulation Audit" key="single">
          <ControlSection>
            <StyledSelect
              placeholder="Select a regulation to audit"
              onChange={setSelectedRegulation}
              value={selectedRegulation}
              showSearch
              filterOption={(input, option) =>
                option.children.toLowerCase().includes(input.toLowerCase())
              }
            >
              {DEMO_REGULATIONS.map(reg => (
                <Option key={reg.slug} value={reg.slug}>
                  {reg.name}
                </Option>
              ))}
            </StyledSelect>

            <AuditButton
              type="primary"
              className="single-audit"
              icon={<FileSearchOutlined />}
              onClick={handleSingleAudit}
              loading={auditLoading}
              disabled={!selectedRegulation}
            >
              {auditLoading ? 'Running Audit...' : 'Run AI Audit'}
            </AuditButton>
          </ControlSection>

          {error && (
            <Alert
              message="Audit Error"
              description={error}
              type="error"
              showIcon
              closable
              onClose={() => setError(null)}
              style={{ marginBottom: 16 }}
            />
          )}

          {auditLoading && (
            <Card>
              <div style={{ textAlign: 'center', padding: '40px 0' }}>
                <Spin size="large" />
                <div style={{ marginTop: 16, fontSize: '1rem', color: '#6c757d' }}>
                  Running comprehensive audit with AI semantic analysis...
                </div>
                <div style={{ marginTop: 8, fontSize: '0.875rem', color: '#9ca3af' }}>
                  This may take 15-30 seconds
                </div>
              </div>
            </Card>
          )}

          {auditResult && (
            <ResultsContainer>
              <ScoreCard className={getScoreClass(auditResult.overallScore || 0)}>
                <ScoreHeader>
                  <div>
                    <h3 style={{ margin: '0 0 4px 0', fontSize: '1.25rem' }}>Overall Quality Score</h3>
                    <div style={{ color: '#6c757d', fontSize: '0.875rem' }}>
                      {DEMO_REGULATIONS.find(r => r.slug === selectedRegulation)?.name || 'Unknown Regulation'}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <ScoreBadge color={getScoreColor(auditResult.overallScore || 0)}>
                      {auditResult.overallScore || 0}/100
                    </ScoreBadge>
                    <CertaintyBadge color={getCertaintyColor(auditResult.certaintyLevel || 'D')}>
                      Certainty: {auditResult.certaintyLevel || 'D'}
                    </CertaintyBadge>
                  </div>
                </ScoreHeader>

                <MetricsGrid>
                  <MetricItem color="#3b82f6">
                    <MetricLabel>Content Quality</MetricLabel>
                    <MetricValue>{auditResult.scores?.content || auditResult.contentScore || 0}/100</MetricValue>
                  </MetricItem>
                  <MetricItem color="#8b5cf6">
                    <MetricLabel>Summary Quality</MetricLabel>
                    <MetricValue>{auditResult.scores?.summary || auditResult.summaryScore || 0}/100</MetricValue>
                  </MetricItem>
                  <MetricItem color="#10b981">
                    <MetricLabel>Requirements</MetricLabel>
                    <MetricValue>{auditResult.scores?.requirements || auditResult.requirementsScore || 0}/100</MetricValue>
                  </MetricItem>
                  <MetricItem color="#f59e0b">
                    <MetricLabel>Deadlines</MetricLabel>
                    <MetricValue>{auditResult.scores?.deadlines || auditResult.deadlinesScore || 0}/100</MetricValue>
                  </MetricItem>
                </MetricsGrid>

                {auditResult.aiAnalysis?.enabled && (
                  <AISection>
                    <AISectionHeader>
                      <RobotOutlined />
                      AI Semantic Analysis
                      <Badge count="ACTIVE" style={{ backgroundColor: '#10b981' }} />
                    </AISectionHeader>

                    <div style={{ fontSize: '0.875rem', opacity: 0.9, marginBottom: 12 }}>
                      Model: {auditResult.aiAnalysis.model}
                    </div>

                    <AIMetricsGrid>
                      <AIMetricCard>
                        <AIMetricLabel>Legal Accuracy</AIMetricLabel>
                        <AIMetricScore>{auditResult.aiAnalysis.legalAccuracy?.score || 0}/100</AIMetricScore>
                      </AIMetricCard>
                      <AIMetricCard>
                        <AIMetricLabel>Completeness</AIMetricLabel>
                        <AIMetricScore>{auditResult.aiAnalysis.completeness?.score || 0}/100</AIMetricScore>
                      </AIMetricCard>
                      <AIMetricCard>
                        <AIMetricLabel>Clarity</AIMetricLabel>
                        <AIMetricScore>{auditResult.aiAnalysis.clarity?.score || 0}/100</AIMetricScore>
                      </AIMetricCard>
                      <AIMetricCard>
                        <AIMetricLabel>Actionability</AIMetricLabel>
                        <AIMetricScore>{auditResult.aiAnalysis.actionability?.score || 0}/100</AIMetricScore>
                      </AIMetricCard>
                    </AIMetricsGrid>

                    <AIAssessment>
                      <div style={{ fontWeight: 600, marginBottom: 8 }}>AI Assessment:</div>
                      {auditResult.aiAnalysis.overallAssessment || 'No assessment available'}
                    </AIAssessment>
                  </AISection>
                )}

                {(auditResult.issues?.length > 0 || auditResult.warnings?.length > 0) && (
                  <IssuesList>
                    <h4 style={{ marginBottom: 12 }}>Issues & Warnings</h4>
                    {auditResult.issues?.map((issue, idx) => (
                      <IssueItem key={`issue-${idx}`} type="error">
                        <StatusIcon>❌</StatusIcon>
                        {typeof issue === 'string' ? issue : issue.message || JSON.stringify(issue)}
                      </IssueItem>
                    ))}
                    {auditResult.warnings?.map((warning, idx) => (
                      <IssueItem key={`warning-${idx}`} type="warning">
                        <StatusIcon>⚠️</StatusIcon>
                        {typeof warning === 'string' ? warning : warning.message || JSON.stringify(warning)}
                      </IssueItem>
                    ))}
                  </IssuesList>
                )}

                {auditResult.recommendations?.length > 0 && (
                  <IssuesList>
                    <h4 style={{ marginBottom: 12 }}>Recommendations</h4>
                    {auditResult.recommendations.map((rec, idx) => (
                      <IssueItem key={`rec-${idx}`} type="info">
                        <StatusIcon>💡</StatusIcon>
                        {typeof rec === 'string' ? rec : rec.message || JSON.stringify(rec)}
                      </IssueItem>
                    ))}
                  </IssuesList>
                )}
              </ScoreCard>
            </ResultsContainer>
          )}
        </TabPane>

        <TabPane tab="Batch Audit (All 10 Demo Regs)" key="batch">
          <ControlSection>
            <AuditButton
              type="primary"
              className="batch-audit"
              icon={<RobotOutlined />}
              onClick={handleBatchAudit}
              loading={batchLoading}
            >
              {batchLoading ? 'Auditing All Regulations...' : 'Run Batch AI Audit (10 Regulations)'}
            </AuditButton>
            {batchLoading && (
              <div style={{ color: '#6c757d', fontSize: '0.875rem' }}>
                This will take 3-5 minutes to complete...
              </div>
            )}
          </ControlSection>

          {batchLoading && (
            <Card>
              <div style={{ textAlign: 'center', padding: '40px 0' }}>
                <Spin size="large" />
                <div style={{ marginTop: 16, fontSize: '1rem', color: '#6c757d' }}>
                  Running batch audit on all 10 demo regulations...
                </div>
                <div style={{ marginTop: 8, fontSize: '0.875rem', color: '#9ca3af' }}>
                  Processing with AI semantic analysis
                </div>
              </div>
            </Card>
          )}

          {batchResults && (
            <BatchResultsGrid>
              {batchResults.map((result, idx) => (
                <BatchResultCard key={result.slug}>
                  <BatchResultHeader>
                    <div>
                      <RegulationName>{result.name}</RegulationName>
                      <div style={{ fontSize: '0.875rem', color: '#6c757d', marginTop: 4 }}>
                        Certainty: {result.audit.certaintyLevel}
                      </div>
                    </div>
                    <BatchScoreBadge color={getScoreColor(result.audit.overallScore)}>
                      {result.audit.overallScore}/100
                    </BatchScoreBadge>
                  </BatchResultHeader>

                  <Progress
                    percent={result.audit.overallScore}
                    strokeColor={getScoreColor(result.audit.overallScore)}
                    showInfo={false}
                  />

                  <div style={{ display: 'flex', gap: '12px', marginTop: 12, fontSize: '0.875rem' }}>
                    <div>
                      <strong>Content:</strong> {result.audit.contentScore}
                    </div>
                    <div>
                      <strong>Summary:</strong> {result.audit.summaryScore}
                    </div>
                    <div>
                      <strong>Reqs:</strong> {result.audit.requirementsScore}
                    </div>
                    <div>
                      <strong>Deadlines:</strong> {result.audit.deadlinesScore}
                    </div>
                  </div>

                  {result.audit.aiAnalysis?.enabled && (
                    <Tag color="purple" style={{ marginTop: 8 }}>
                      <RobotOutlined /> AI Analyzed
                    </Tag>
                  )}
                </BatchResultCard>
              ))}
            </BatchResultsGrid>
          )}
        </TabPane>
      </Tabs>
    </PanelContainer>
  );
};

export default InquisitorPanel;



