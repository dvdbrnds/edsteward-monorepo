Improved file upload dialogs in EdSteward (January 2026):

**Problem**: Native browser file inputs ("Choose File" button) looked awkward and non-distinctive in the UI.

**Solution**: Replaced with styled drag-and-drop zones:
- Hidden native `<input type="file">` element
- Visible dashed-border drop zone that responds to:
  - Click events (triggers file dialog)
  - Drag-over events (changes border color to primary)
  - Drop events (accepts dropped files)
- Visual feedback states:
  - Default: muted border with "Click to browse or drag & drop" text
  - Hover: primary/50 border color
  - Drag over: primary border with primary/5 background
  - File selected: green border with green/50 background, shows file name and size
- File preview with remove button (X icon)

**Files updated**:
- `client/src/components/regulations/evidence-files.tsx`
- `client/src/components/regulations/task-detail-dialog.tsx`

**Key imports needed**:
```typescript
import { cn } from "@/lib/utils";
import { File, X, Upload } from "lucide-react";
```

**Key state variables**:
```typescript
const fileInputRef = useRef<HTMLInputElement>(null);
const [isDragOver, setIsDragOver] = useState(false);
const [selectedFile, setSelectedFile] = useState<File | null>(null);
```

This pattern should be used for all file upload dialogs in the application for consistency.