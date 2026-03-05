Successfully implemented complete MFA (Multi-Factor Authentication) system in EdSteward with QR code generation. Key components:

**Frontend MFA Setup Component** (`client/src/components/features/mfa/mfa-setup.tsx`):
```typescript
// MFA Setup with QR Code Generation
interface MFASetupData {
  setup: {
    qrCodeUrl: string;
    manualEntryKey: string;
    backupCodes: string[];
  };
}

export default function MFASetup() {
  const [setupData, setSetupData] = useState<MFASetupData | null>(null);
  
  // Generate MFA setup data
  const { mutate: generateSetup, isPending: isGenerating } = useMutation<MFASetupData>({
    mutationFn: () => apiRequest("POST", "/api/mfa/setup/generate"),
    onSuccess: (data) => {
      setSetupData(data); // Critical: persist data in component state
      setForceShowQR(true);
    },
  });

  // QR Code Display
  <img
    src={setupData.setup.qrCodeUrl}
    alt="MFA QR Code"
    className="w-48 h-48"
  />
}
```

**Backend MFA Service** (`server/services/mfa.ts`):
```typescript
// QR Code Generation with OTPAuth
import * as OTPAuth from "otpauth";
import * as QRCode from "qrcode";

static async generateSetup(userId: number, email: string): Promise<MFASetupResult> {
  const secret = new OTPAuth.Secret();
  const totp = new OTPAuth.TOTP({
    issuer: "EdSteward",
    label: email,
    algorithm: "SHA1",
    digits: 6,
    period: 30,
    secret: secret,
  });
  
  const otpauthUrl = totp.toString();
  const qrCodeUrl = await QRCode.toDataURL(otpauthUrl); // Base64 PNG data URL
  
  return {
    secret: secret.base32,
    qrCodeUrl,
    backupCodes,
    manualEntryKey: secret.base32.match(/.{1,4}/g)?.join(' ') || secret.base32,
  };
}
```

**API Route** (`server/routes/api/mfa.ts`):
```typescript
// MFA Setup Generation Endpoint
router.post('/setup/generate', requireAuth, async (req: Request, res: Response) => {
  const setupData = await MFAService.generateSetup(user.id, user.email);
  
  req.session.mfaSetup = {
    secret: setupData.secret,
    backupCodes: setupData.backupCodes,
    userId: user.id,
    generatedAt: new Date(),
  };

  res.json({
    success: true,
    setup: {
      qrCodeUrl: setupData.qrCodeUrl, // Base64 PNG data URL
      manualEntryKey: setupData.manualEntryKey,
      backupCodes: setupData.backupCodes,
    },
  });
});
```

**Critical Implementation Details**:
1. **Data Structure**: Server returns `{ setup: { qrCodeUrl, manualEntryKey, backupCodes } }`
2. **State Management**: Must use `useState` and `setSetupData(data)` in `onSuccess` callback
3. **QR Code Format**: `qrcode` package generates base64 PNG data URL (`data:image/png;base64,...`)
4. **API Call**: Use `apiRequest("POST", "/api/mfa/setup/generate")` signature
5. **Navigation**: Account Settings accessible via user dropdown menu at `/account/settings`

**Common Issues Fixed**:
- Variable declaration conflicts (`isGenerating` declared twice)
- API response structure mismatch (expecting `qrCode` vs actual `setup.qrCodeUrl`)
- React state not persisting mutation results
- Frontend build caching preventing updates

The MFA system now generates working QR codes for Google Authenticator with proper TOTP configuration.