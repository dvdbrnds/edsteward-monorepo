// EdSteward Preview Tab Injector
// Paste this code in browser console while on the TEACH Act regulation page

(function() {
    console.log('🚀 Injecting EdSteward Preview Tab...');
    
    // Find the tab container
    const tabContainer = document.querySelector('.tab-container') || 
                        document.querySelector('.tabs') || 
                        document.querySelector('[class*="tab"]') ||
                        document.querySelector('.workflow-tabs');
    
    if (!tabContainer) {
        console.log('⚠️ No tab container found, creating new tab structure...');
        createNewTabStructure();
        return;
    }
    
    // Add EdSteward Preview tab
    const edstewardTab = document.createElement('div');
    edstewardTab.className = 'tab-button';
    edstewardTab.innerHTML = '📋 EdSteward Preview';
    edstewardTab.style.cssText = `
        background: #4299e1;
        color: white;
        padding: 10px 20px;
        margin: 5px;
        border-radius: 6px;
        cursor: pointer;
        display: inline-block;
        font-weight: bold;
    `;
    
    // Add tab content area
    const edstewardContent = document.createElement('div');
    edstewardContent.id = 'edsteward-preview-content';
    edstewardContent.style.cssText = `
        display: none;
        background: white;
        border: 2px solid #4299e1;
        border-radius: 8px;
        padding: 20px;
        margin: 20px 0;
        max-height: 600px;
        overflow-y: auto;
    `;
    
    // Insert tab and content
    tabContainer.appendChild(edstewardTab);
    tabContainer.parentNode.insertBefore(edstewardContent, tabContainer.nextSibling);
    
    // Tab click handler
    edstewardTab.addEventListener('click', function() {
        // Hide other tab contents
        document.querySelectorAll('[id*="content"], [class*="content"]').forEach(el => {
            if (el.style.display !== 'none') el.style.display = 'none';
        });
        
        // Show EdSteward content
        edstewardContent.style.display = 'block';
        
        // Update tab styles
        document.querySelectorAll('.tab-button').forEach(tab => {
            tab.style.background = '#e2e8f0';
            tab.style.color = '#4a5568';
        });
        edstewardTab.style.background = '#4299e1';
        edstewardTab.style.color = 'white';
        
        // Load EdSteward preview data
        loadEdStewardPreview();
    });
    
    console.log('✅ EdSteward Preview tab added! Click the "📋 EdSteward Preview" tab to see the data.');
    
    function createNewTabStructure() {
        // Create tab structure if none exists
        const mainContent = document.querySelector('main') || 
                           document.querySelector('.container') || 
                           document.querySelector('body');
        
        const tabStructure = document.createElement('div');
        tabStructure.innerHTML = `
            <div style="margin: 20px 0; padding: 20px; background: #f8fafc; border-radius: 8px;">
                <h2 style="color: #2d3748; margin-bottom: 15px;">📊 Regulation Data Views</h2>
                <div class="tab-container" style="margin-bottom: 20px;">
                    <div class="tab-button" onclick="showOriginalContent()" style="background: #e2e8f0; color: #4a5568; padding: 10px 20px; margin: 5px; border-radius: 6px; cursor: pointer; display: inline-block;">📄 Original Console</div>
                    <div class="tab-button" onclick="showEdStewardPreview()" style="background: #4299e1; color: white; padding: 10px 20px; margin: 5px; border-radius: 6px; cursor: pointer; display: inline-block; font-weight: bold;">📋 EdSteward Preview</div>
                </div>
                <div id="edsteward-preview-content" style="background: white; border: 2px solid #4299e1; border-radius: 8px; padding: 20px; max-height: 600px; overflow-y: auto;">
                    <div style="text-align: center; padding: 40px; color: #666;">
                        <div style="font-size: 48px; margin-bottom: 20px;">🔄</div>
                        <h3>Loading EdSteward Preview...</h3>
                        <p>Fetching enhanced Federal Register data...</p>
                    </div>
                </div>
            </div>
        `;
        
        mainContent.insertBefore(tabStructure, mainContent.firstChild);
        
        // Auto-load EdSteward preview
        setTimeout(loadEdStewardPreview, 1000);
        
        console.log('✅ Created new tab structure with EdSteward Preview!');
    }
    
    async function loadEdStewardPreview() {
        const content = document.getElementById('edsteward-preview-content');
        
        content.innerHTML = `
            <div style="text-align: center; padding: 40px; color: #666;">
                <div style="font-size: 48px; margin-bottom: 20px;">🔄</div>
                <h3>Loading EdSteward Preview...</h3>
                <p>Fetching enhanced Federal Register data...</p>
            </div>
        `;
        
        try {
            console.log('📡 Fetching enhanced TEACH Act data for EdSteward preview...');
            
            const response = await fetch('http://localhost:3002/api/llm/cfr/enhanced/teach-act?federal_register=true');
            const data = await response.json();
            
            if (!data.success) {
                throw new Error(data.error || 'Failed to fetch enhanced data');
            }
            
            const enhancedData = data.data;
            
            // Format EdSteward payload preview
            const edstewardPayload = {
                regulationId: 'REG-66',
                name: 'Technology, Education and Copyright Harmonization Act (TEACH Act) of 2002',
                originalContent: 'Previous CFR text...',
                updatedContent: enhancedData.regulation_text,
                status: 'pending',
                summary: enhancedData.summary,
                submission_guidelines: enhancedData.submission_guidelines,
                requirements: enhancedData.requirements,
                source_attribution: enhancedData.source_attribution,
                federal_register_enhancement: enhancedData.federal_register_enhancement,
                processing_metadata: enhancedData.processing_metadata,
                metadata: {
                    mcpEngineId: 'REG-66',
                    timestamp: new Date().toISOString(),
                    enhanced: true,
                    federalRegisterEnhanced: enhancedData.federal_register_enhancement?.successful || false
                }
            };
            
            // Display the preview
            content.innerHTML = `
                <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; border-radius: 8px; margin-bottom: 20px; text-align: center;">
                    <h2 style="margin: 0; font-size: 1.5em;">📋 EdSteward Customer Preview</h2>
                    <p style="margin: 10px 0 0 0; opacity: 0.9;">This is exactly what EdSteward customers will receive</p>
                </div>
                
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 20px;">
                    <div style="background: #f0fff4; border: 2px solid #48bb78; border-radius: 8px; padding: 15px;">
                        <h3 style="color: #22543d; margin-top: 0;">✅ Enhancement Status</h3>
                        <p><strong>Enhanced:</strong> ${enhancedData.enhanced ? '✅ Yes' : '❌ No'}</p>
                        <p><strong>Federal Register:</strong> ${enhancedData.federal_register_enhancement?.successful ? '✅ Integrated' : '❌ Failed'}</p>
                        <p><strong>Documents Referenced:</strong> ${enhancedData.federal_register_enhancement?.total_documents_referenced || 0}</p>
                        <p><strong>Source:</strong> ${enhancedData.source_attribution}</p>
                    </div>
                    
                    <div style="background: #fffaf0; border: 2px solid #ed8936; border-radius: 8px; padding: 15px;">
                        <h3 style="color: #9c4221; margin-top: 0;">📊 Content Stats</h3>
                        <p><strong>Total Characters:</strong> ${enhancedData.regulation_text?.length || 0}</p>
                        <p><strong>Requirements:</strong> ${enhancedData.requirements?.length || 0}</p>
                        <p><strong>Processing Time:</strong> ${enhancedData.processing_metadata?.processing_time_ms || 'N/A'}ms</p>
                        <p><strong>CFR Citations:</strong> ${enhancedData.federal_register_enhancement?.cfr_citations_processed || 0}</p>
                    </div>
                </div>
                
                <div style="background: #f7fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 20px; margin-bottom: 20px;">
                    <h3 style="color: #2d3748; margin-top: 0;">📄 EdSteward Payload Structure</h3>
                    <pre style="background: #1a202c; color: #e2e8f0; padding: 15px; border-radius: 6px; overflow-x: auto; font-size: 12px;">${JSON.stringify(edstewardPayload, null, 2)}</pre>
                </div>
                
                <div style="background: #edf2f7; border: 1px solid #cbd5e0; border-radius: 8px; padding: 20px; margin-bottom: 20px;">
                    <h3 style="color: #2d3748; margin-top: 0;">📋 Enhanced Content Preview</h3>
                    <div style="max-height: 200px; overflow-y: auto; background: white; padding: 15px; border-radius: 6px; border: 1px solid #e2e8f0;">
                        <p><strong>Summary:</strong></p>
                        <p style="margin-bottom: 15px;">${enhancedData.summary || 'No summary available'}</p>
                        
                        <p><strong>Content Preview (first 500 chars):</strong></p>
                        <p style="font-family: monospace; font-size: 12px; background: #f8f9fa; padding: 10px; border-radius: 4px;">
                            ${(enhancedData.regulation_text || '').substring(0, 500)}...
                        </p>
                    </div>
                </div>
                
                <div style="background: #f0fff4; border: 1px solid #9ae6b4; border-radius: 8px; padding: 20px;">
                    <h3 style="color: #22543d; margin-top: 0;">📚 Federal Register Integration Details</h3>
                    ${enhancedData.federal_register_enhancement?.contexts ? 
                        enhancedData.federal_register_enhancement.contexts.map((context, i) => `
                            <div style="background: white; border: 1px solid #c6f6d5; border-radius: 6px; padding: 12px; margin: 10px 0;">
                                <strong>${i + 1}. ${context.title || 'Federal Register Document'}</strong><br>
                                <small style="color: #666;">
                                    Document: ${context.document_number || 'N/A'} | 
                                    Date: ${context.publication_date || 'N/A'} | 
                                    Length: ${context.full_text?.length || 0} characters
                                </small>
                            </div>
                        `).join('') : 
                        '<p>No Federal Register contexts available</p>'
                    }
                </div>
                
                <div style="text-align: center; margin-top: 30px; padding: 20px; background: #e6fffa; border: 2px solid #38b2ac; border-radius: 8px;">
                    <h3 style="color: #234e52; margin-top: 0;">🎉 Integration Success!</h3>
                    <p style="color: #285e61; margin-bottom: 0;">
                        EdSteward customers will receive <strong>${enhancedData.regulation_text?.length || 0} characters</strong> 
                        of enhanced regulation content with <strong>${enhancedData.federal_register_enhancement?.total_documents_referenced || 0} Federal Register documents</strong> 
                        providing comprehensive regulatory context!
                    </p>
                </div>
            `;
            
            console.log('✅ EdSteward preview loaded successfully!');
            
        } catch (error) {
            console.error('❌ Error loading EdSteward preview:', error);
            content.innerHTML = `
                <div style="text-align: center; padding: 40px; color: #e53e3e;">
                    <div style="font-size: 48px; margin-bottom: 20px;">❌</div>
                    <h3>Error Loading EdSteward Preview</h3>
                    <p>${error.message}</p>
                    <button onclick="loadEdStewardPreview()" style="background: #4299e1; color: white; border: none; padding: 10px 20px; border-radius: 6px; cursor: pointer; margin-top: 15px;">
                        🔄 Retry
                    </button>
                </div>
            `;
        }
    }
    
    // Make functions global for onclick handlers
    window.showOriginalContent = function() {
        document.getElementById('edsteward-preview-content').style.display = 'none';
        // Show original content (you might need to adjust this selector)
        const originalContent = document.querySelector('.main-content') || document.querySelector('main');
        if (originalContent) originalContent.style.display = 'block';
    };
    
    window.showEdStewardPreview = function() {
        document.getElementById('edsteward-preview-content').style.display = 'block';
        loadEdStewardPreview();
    };
    
    window.loadEdStewardPreview = loadEdStewardPreview;
    
})();

console.log('🎯 EdSteward Preview Injector loaded! The tab should appear on the regulation page.');

