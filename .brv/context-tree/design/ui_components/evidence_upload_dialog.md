## Evidence Upload Dialog UX Improvements (Dec 17, 2025)

The Add Evidence dialog in compliance tasks was redesigned for better UX:

### Tab-based Mode Selector
Instead of confusing button-style mode switchers, use proper tabs with underline indicator:
```tsx
<div className="flex border-b border-gray-200">
  <button
    type="button"
    onClick={() => setEvidenceType('file')}
    className={cn(
      "flex-1 py-2 px-4 text-sm font-medium border-b-2 transition-colors",
      evidenceType === 'file' 
        ? "border-blue-600 text-blue-600" 
        : "border-transparent text-gray-500 hover:text-gray-700"
    )}
  >
    <Upload className="h-4 w-4 inline mr-2" />
    Upload File
  </button>
  {/* Similar for Add Link tab */}
</div>
```

### Styled Drop Zone for File Upload
Replace ugly native file input with styled drop zone:
```tsx
<label 
  htmlFor="evidence-file"
  className={cn(
    "flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-lg cursor-pointer transition-colors",
    evidenceFile 
      ? "border-green-400 bg-green-50" 
      : "border-gray-300 bg-gray-50 hover:bg-gray-100 hover:border-blue-400"
  )}
>
  {evidenceFile ? (
    <div className="flex flex-col items-center text-green-600">
      <FileCheck className="h-8 w-8 mb-2" />
      <p className="text-sm font-medium">{evidenceFile.name}</p>
      <p className="text-xs text-green-500 mt-1">Click to change file</p>
    </div>
  ) : (
    <div className="flex flex-col items-center text-gray-500">
      <Upload className="h-8 w-8 mb-2" />
      <p className="text-sm font-medium">Click to upload</p>
      <p className="text-xs text-gray-400">or drag and drop</p>
    </div>
  )}
  <input id="evidence-file" type="file" className="hidden" onChange={...} />
</label>
```

### Compliance Tasks Auto-Expand
Tasks accordion auto-opens when incomplete, collapses when fully compliant:
```tsx
const [complianceTasksOpen, setComplianceTasksOpen] = useState(true); // Default open

useEffect(() => {
  if (complianceTasks && complianceTasks.length > 0) {
    const allComplete = complianceTasks.every(task => task.status === 'completed');
    if (allComplete) setComplianceTasksOpen(false);
  }
}, [complianceTasks]);
```