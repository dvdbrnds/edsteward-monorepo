#!/usr/bin/env node
/**
 * Rebuild Console Tabs - Streamlined 5-Tab Structure
 * Replaces the old 9-tab layout with the new customer-focused 5 tabs
 */

const fs = require('fs');
const path = require('path');

const consolePath = path.join(__dirname, '../src/client/public/regulations/jeanne-clery-disclosure-of-campus-security-policy--console.html');

// Read the current file
let content = fs.readFileSync(consolePath, 'utf8');

// New 5-tab content structure
const newTabContent = `                <div class="regulation-content">
                    <!-- TAB 1: Regulation Text -->
                    <div id="regulation-text" class="tab-content active">
                        <div class="regulation-section">
                            <div id="reg-text-loading" style="text-align: center; padding: 40px; color: #6e7681;">
                                <div style="font-size: 16px; margin-bottom: 10px;">📖 Fetching Official Regulation Text from eCFR.gov...</div>
                                <div style="font-size: 14px;">Loading 34 CFR 668.46 - Clery Act Implementation</div>
                            </div>
                            <div id="reg-text-content" style="display: none;">
                                <div id="reg-text-metadata" style="font-size: 12px; color: #6e7681; margin-bottom: 20px; padding: 12px; background: #f0f6ff; border-radius: 6px; border-left: 4px solid #0969da;">
                                    <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px;">
                                        <div><strong>Citation:</strong> <span id="reg-citation">Loading...</span></div>
                                        <div><strong>Source:</strong> <span id="reg-source">Loading...</span></div>
                                        <div><strong>Last Verified:</strong> <span id="reg-verified">Loading...</span></div>
                                    </div>
                                </div>
                                <div class="legal-text" id="reg-text-body" style="max-height: 400px; overflow-y: auto; padding: 16px; background: #fafbfc; border-radius: 8px; border: 1px solid #e1e5e9; line-height: 1.8; font-size: 14px;">
                                    <!-- Regulation text loaded here -->
                                </div>
                            </div>
                            <div id="reg-text-error" style="display: none; text-align: center; padding: 40px; color: #d73a49;">
                                <div style="font-size: 16px; margin-bottom: 10px;">❌ Unable to Load Regulation Text</div>
                                <div id="reg-text-error-msg" style="font-size: 14px;">Network error</div>
                                <button onclick="loadRegulationText()" style="margin-top: 15px; padding: 8px 16px; background: #0969da; color: white; border: none; border-radius: 4px; cursor: pointer;">🔄 Retry</button>
                            </div>
                        </div>
                    </div>
                    
                    <!-- TAB 2: Summary & Scope -->
                    <div id="summary-scope" class="tab-content">
                        <div class="regulation-section">
                            <div id="summary-loading" style="text-align: center; padding: 40px; color: #6e7681;">
                                <div style="font-size: 16px;">📋 Loading Summary & Scope...</div>
                            </div>
                            <div id="summary-content" style="display: none;">
                                <!-- Summary Box -->
                                <div style="background: linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%); border: 1px solid #0ea5e9; border-radius: 8px; padding: 20px; margin-bottom: 24px;">
                                    <h5 style="margin: 0 0 12px 0; color: #0c4a6e;">📋 Plain Language Summary</h5>
                                    <div id="summary-text" style="font-size: 15px; line-height: 1.7; color: #1e3a5f;"></div>
                                </div>
                                
                                <!-- Scope Grid -->
                                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px;">
                                    <div style="background: #f8fafc; border-radius: 8px; padding: 20px; border: 1px solid #e2e8f0;">
                                        <h5 style="margin: 0 0 16px 0; color: #1e293b;">🎯 Who Must Comply</h5>
                                        <ul id="scope-who" style="margin: 0; padding-left: 20px; line-height: 1.8;"></ul>
                                    </div>
                                    <div style="background: #f8fafc; border-radius: 8px; padding: 20px; border: 1px solid #e2e8f0;">
                                        <h5 style="margin: 0 0 16px 0; color: #1e293b;">🏢 Departments Responsible</h5>
                                        <div id="scope-departments" style="display: flex; flex-wrap: wrap; gap: 8px;"></div>
                                    </div>
                                </div>
                                
                                <!-- Key Requirements -->
                                <div style="margin-top: 24px; background: #fffbeb; border-radius: 8px; padding: 20px; border: 1px solid #fcd34d;">
                                    <h5 style="margin: 0 0 16px 0; color: #92400e;">⚡ Key Requirements</h5>
                                    <div id="key-requirements" style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;"></div>
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    <!-- TAB 3: Tasks & Deadlines -->
                    <div id="tasks-deadlines" class="tab-content">
                        <div class="regulation-section">
                            <div id="tasks-loading" style="text-align: center; padding: 40px; color: #6e7681;">
                                <div style="font-size: 16px;">📅 Loading Tasks & Deadlines...</div>
                            </div>
                            <div id="tasks-content" style="display: none;">
                                <!-- Deadlines Section -->
                                <div style="margin-bottom: 24px;">
                                    <h5 style="margin: 0 0 16px 0; color: #1e293b; font-size: 16px;">📅 Filing Deadlines</h5>
                                    <div id="deadlines-list" style="display: grid; gap: 12px;"></div>
                                </div>
                                
                                <!-- Tasks Section -->
                                <div>
                                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
                                        <h5 style="margin: 0; color: #1e293b; font-size: 16px;">✅ Compliance Tasks</h5>
                                        <span id="task-count" style="background: #dbeafe; color: #1d4ed8; padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: 600;"></span>
                                    </div>
                                    <div id="tasks-list" style="display: flex; flex-direction: column; gap: 12px; max-height: 350px; overflow-y: auto;"></div>
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    <!-- TAB 4: Risk Assessment -->
                    <div id="risk-assessment" class="tab-content">
                        <div class="regulation-section">
                            <div id="risk-loading" style="text-align: center; padding: 40px; color: #6e7681;">
                                <div style="font-size: 16px;">⚠️ Loading Risk Assessment...</div>
                            </div>
                            <div id="risk-content" style="display: none;">
                                <!-- IRS Score Banner -->
                                <div id="irs-banner" style="background: linear-gradient(135deg, #dc2626 0%, #b91c1c 100%); color: white; border-radius: 12px; padding: 24px; margin-bottom: 24px; text-align: center;">
                                    <div style="font-size: 14px; opacity: 0.9; margin-bottom: 8px;">INSTITUTIONAL RISK SCORE</div>
                                    <div id="irs-score" style="font-size: 48px; font-weight: 700; margin-bottom: 8px;">96</div>
                                    <div id="irs-level" style="font-size: 18px; font-weight: 600; background: rgba(255,255,255,0.2); padding: 6px 16px; border-radius: 20px; display: inline-block;">CRITICAL</div>
                                </div>
                                
                                <!-- 5 Risk Factors -->
                                <div style="display: grid; grid-template-columns: repeat(5, 1fr); gap: 12px; margin-bottom: 24px;">
                                    <div class="risk-factor" style="background: #fef2f2; border-radius: 8px; padding: 16px; text-align: center; border: 1px solid #fecaca;">
                                        <div style="font-size: 24px; font-weight: 700; color: #dc2626;" id="rf-financial">30</div>
                                        <div style="font-size: 11px; color: #991b1b; margin-top: 4px;">Financial Penalty</div>
                                        <div style="font-size: 10px; color: #9ca3af;">/30 max</div>
                                    </div>
                                    <div class="risk-factor" style="background: #fef2f2; border-radius: 8px; padding: 16px; text-align: center; border: 1px solid #fecaca;">
                                        <div style="font-size: 24px; font-weight: 700; color: #dc2626;" id="rf-funding">25</div>
                                        <div style="font-size: 11px; color: #991b1b; margin-top: 4px;">Federal Funding</div>
                                        <div style="font-size: 10px; color: #9ca3af;">/25 max</div>
                                    </div>
                                    <div class="risk-factor" style="background: #fef2f2; border-radius: 8px; padding: 16px; text-align: center; border: 1px solid #fecaca;">
                                        <div style="font-size: 24px; font-weight: 700; color: #dc2626;" id="rf-accreditation">18</div>
                                        <div style="font-size: 11px; color: #991b1b; margin-top: 4px;">Accreditation</div>
                                        <div style="font-size: 10px; color: #9ca3af;">/20 max</div>
                                    </div>
                                    <div class="risk-factor" style="background: #fef2f2; border-radius: 8px; padding: 16px; text-align: center; border: 1px solid #fecaca;">
                                        <div style="font-size: 24px; font-weight: 700; color: #dc2626;" id="rf-reputation">15</div>
                                        <div style="font-size: 11px; color: #991b1b; margin-top: 4px;">Reputation/Legal</div>
                                        <div style="font-size: 10px; color: #9ca3af;">/15 max</div>
                                    </div>
                                    <div class="risk-factor" style="background: #fef2f2; border-radius: 8px; padding: 16px; text-align: center; border: 1px solid #fecaca;">
                                        <div style="font-size: 24px; font-weight: 700; color: #dc2626;" id="rf-operations">8</div>
                                        <div style="font-size: 11px; color: #991b1b; margin-top: 4px;">Operations</div>
                                        <div style="font-size: 10px; color: #9ca3af;">/10 max</div>
                                    </div>
                                </div>
                                
                                <!-- Validation & Enforcement -->
                                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px;">
                                    <div style="background: #f0fdf4; border-radius: 8px; padding: 20px; border: 1px solid #86efac;">
                                        <h6 style="margin: 0 0 12px 0; color: #166534;">✓ Validation Status</h6>
                                        <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                                            <span>L.O.V.V. Level:</span>
                                            <span id="lovv-level" style="font-weight: 600; color: #166534;">B</span>
                                        </div>
                                        <div style="display: flex; justify-content: space-between;">
                                            <span>Last Validated:</span>
                                            <span id="last-validated" style="font-weight: 600;">Loading...</span>
                                        </div>
                                    </div>
                                    <div style="background: #fff7ed; border-radius: 8px; padding: 20px; border: 1px solid #fdba74;">
                                        <h6 style="margin: 0 0 12px 0; color: #9a3412;">⚖️ Enforcement History</h6>
                                        <div id="enforcement-history" style="font-size: 13px; line-height: 1.6;"></div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    <!-- TAB 5: Customer Payload -->
                    <div id="customer-payload" class="tab-content">
                        <div class="regulation-section">
                            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                                <h4 style="margin: 0;">📤 EdSteward Customer Payload</h4>
                                <div style="display: flex; gap: 8px;">
                                    <button onclick="validatePayload()" style="padding: 8px 16px; background: #3b82f6; color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: 500;">✓ Validate</button>
                                    <button onclick="copyPayload()" style="padding: 8px 16px; background: #6b7280; color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: 500;">📋 Copy JSON</button>
                                    <button onclick="sendPayloadToEdSteward()" style="padding: 8px 16px; background: linear-gradient(135deg, #059669, #10b981); color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: 600;">📤 Send to EdSteward</button>
                                </div>
                            </div>
                            
                            <div id="payload-status" style="padding: 12px 16px; background: #f0fdf4; border: 1px solid #86efac; border-radius: 6px; margin-bottom: 20px; display: flex; align-items: center; gap: 10px;">
                                <span style="font-size: 18px;">✅</span>
                                <span style="color: #166534; font-weight: 500;">Payload Ready - All required fields present</span>
                            </div>
                            
                            <div style="background: #1e293b; border-radius: 8px; overflow: hidden;">
                                <div style="background: #334155; padding: 12px 16px; display: flex; justify-content: space-between; align-items: center;">
                                    <span style="color: #94a3b8; font-size: 12px; font-weight: 600;">EDSTEWARD PAYLOAD JSON</span>
                                    <span id="payload-size" style="color: #94a3b8; font-size: 11px;"></span>
                                </div>
                                <pre id="payload-json" style="margin: 0; padding: 20px; color: #e2e8f0; font-family: 'SF Mono', Monaco, monospace; font-size: 12px; line-height: 1.6; max-height: 400px; overflow-y: auto; white-space: pre-wrap;"></pre>
                            </div>
                        </div>
                    </div>
                </div>
            </div>`;

// Find the old regulation-content div and replace it
// Pattern: from <div class="regulation-content"> to the closing of regulation-preview (</div>\s*</div>)
const startMarker = '<div class="regulation-content">';
const endPattern = /                <\/div>\s*<\/div>\s*\n\s*<div class="console-output"/;

const startIdx = content.indexOf(startMarker);
if (startIdx === -1) {
    console.error('Could not find start marker');
    process.exit(1);
}

// Find the end by looking for console-output div
const afterStart = content.substring(startIdx);
const endMatch = afterStart.match(endPattern);
if (!endMatch) {
    console.error('Could not find end marker');
    process.exit(1);
}

const endIdx = startIdx + endMatch.index;
const beforeContent = content.substring(0, startIdx);
const afterContent = content.substring(endIdx);

// Replace with new content
content = beforeContent + newTabContent + '\n            </div>\n' + afterContent;

// Write back
fs.writeFileSync(consolePath, content, 'utf8');
console.log('✅ Console tabs rebuilt successfully!');
console.log('   Old: 9 tabs (USC Text, Plain Summary, CFR Regulations, Analysis & Scope, etc.)');
console.log('   New: 5 tabs (Regulation Text, Summary & Scope, Tasks & Deadlines, Risk Assessment, Customer Payload)');
