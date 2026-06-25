import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { apiGet, apiPost } from '@/lib/api';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  ArrowLeft, Copy, Check, RefreshCw, KeyRound,
  User, Mail, Globe, Shield, Loader2, AlertCircle,
} from 'lucide-react';

const PASSPHRASE_WORDS = [
  'apple','arrow','badge','beach','bell','bird','bloom','board','bonus','brave',
  'brick','bridge','bright','brook','cabin','camel','candy','cedar','chain','chair',
  'chalk','charm','chase','chess','chief','claim','clash','clean','cliff','climb',
  'clock','cloud','coach','coral','crane','creek','crest','crown','crush','dance',
  'delta','dream','drift','eagle','earth','ember','fence','field','flame','flash',
  'fleet','flint','flora','forge','frost','giant','glade','gleam','globe','grace',
  'grain','grape','grass','green','grove','guard','haven','hazel','heart','heron',
  'honey','ivory','jewel','knoll','larch','lemon','light','lilac','linen','lunar',
  'maple','marsh','mason','melon','mirth','moose','noble','north','ocean','olive',
  'onyx','orbit','otter','pansy','patch','peach','pearl','petal','pilot','plume',
  'polar','poppy','prism','quail','quart','quest','raven','ridge','river','robin',
  'royal','sable','sage','scout','shade','shell','shore','sigma','slate','solar',
  'spark','spire','stag','steam','steel','stone','storm','stove','swamp','swift',
  'thorn','tiger','torch','tower','trace','trail','tulip','umbra','unity','valor',
  'velvet','vigor','viola','vivid','waltz','watch','wheat','willow','wren','zenith',
];

function generatePassphrase(): string {
  const words: string[] = [];
  for (let i = 0; i < 4; i++) {
    words.push(PASSPHRASE_WORDS[Math.floor(Math.random() * PASSPHRASE_WORDS.length)]);
  }
  return words.join('');
}

interface AdminUser {
  id: number;
  username: string;
  email: string;
  role: string;
  firstName: string;
  lastName: string;
  created_at: string;
}

interface CredentialsData {
  tenant: { id: string; name: string; subdomain: string };
  admins: AdminUser[];
  loginUrl: string;
}

export default function TenantCredentialsPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [data, setData] = useState<CredentialsData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedAdmin, setSelectedAdmin] = useState<string>('');
  const [newPassword, setNewPassword] = useState(generatePassphrase());
  const [isResetting, setIsResetting] = useState(false);
  const [resetDone, setResetDone] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    fetchCredentials();
  }, [id]);

  const fetchCredentials = async () => {
    try {
      const result = await apiGet<CredentialsData>(`/api/customers/${id}/credentials`);
      setData(result);
      if (result.admins.length > 0) {
        setSelectedAdmin(result.admins[0].username);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load credentials');
    } finally {
      setIsLoading(false);
    }
  };

  const handleReset = async () => {
    if (!selectedAdmin || !newPassword) return;
    setIsResetting(true);
    setResetDone(false);
    try {
      await apiPost(`/api/customers/${id}/reset-password`, {
        username: selectedAdmin,
        newPassword,
      });
      setResetDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reset password');
    } finally {
      setIsResetting(false);
    }
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopied(label);
    setTimeout(() => setCopied(null), 2000);
  };

  const emailTemplate = data ? `Hi,

Your EdSteward account is ready. Here are your login credentials:

  Login URL:  ${data.loginUrl}
  Username:   ${selectedAdmin}
  Password:   ${newPassword}

Please log in and change your password immediately.

After logging in, you can configure your organization's branding, 
institution details, and compliance settings from the admin panel.

Best regards,
EdSteward Support` : '';

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="space-y-4">
        <Link to="/customers" className="inline-flex items-center text-sm text-gray-500 hover:text-gray-700">
          <ArrowLeft className="h-4 w-4 mr-1" /> Back to Customers
        </Link>
        <Card className="border-red-200 bg-red-50">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-red-700">
              <AlertCircle className="h-5 w-5" />
              <p>{error}</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link to="/customers" className="inline-flex items-center text-sm text-gray-500 hover:text-gray-700">
            <ArrowLeft className="h-4 w-4 mr-1" /> Customers
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{data.tenant.name}</h1>
            <p className="text-sm text-gray-500">{data.loginUrl}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-purple-100 text-purple-800 text-sm font-medium">
          <Shield className="h-4 w-4" />
          Admin Credentials
        </div>
      </div>

      {/* Admin Users */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <User className="h-5 w-5 text-gray-500" />
            Admin Accounts
          </CardTitle>
        </CardHeader>
        <CardContent>
          {data.admins.length === 0 ? (
            <p className="text-sm text-gray-500">No admin users found in this tenant.</p>
          ) : (
            <div className="divide-y">
              {data.admins.map((admin) => (
                <div key={admin.id} className="flex items-center justify-between py-3">
                  <div className="flex items-center gap-3">
                    <div className="h-9 w-9 rounded-full bg-indigo-100 flex items-center justify-center">
                      <span className="text-sm font-medium text-indigo-700">
                        {(admin.firstName || admin.username)[0].toUpperCase()}
                      </span>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900">{admin.username}</p>
                      <p className="text-xs text-gray-500">
                        {admin.firstName} {admin.lastName}
                        {admin.email ? ` · ${admin.email}` : ''}
                      </p>
                    </div>
                  </div>
                  <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                    selectedAdmin === admin.username
                      ? 'bg-indigo-100 text-indigo-700'
                      : 'bg-gray-100 text-gray-600 cursor-pointer hover:bg-gray-200'
                  }`}
                    onClick={() => { setSelectedAdmin(admin.username); setResetDone(false); }}
                  >
                    {selectedAdmin === admin.username ? 'Selected' : 'Select'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Reset Password */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <KeyRound className="h-5 w-5 text-gray-500" />
            Reset Password for <span className="text-indigo-600">{selectedAdmin}</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">New Password</label>
            <div className="flex items-center gap-2">
              <code className="flex-1 bg-gray-50 border rounded-lg px-4 py-2.5 text-sm font-mono tracking-wide select-all">
                {newPassword}
              </code>
              <Button
                variant="outline" size="sm"
                onClick={() => { setNewPassword(generatePassphrase()); setResetDone(false); }}
              >
                <RefreshCw className="h-4 w-4" />
              </Button>
              <Button
                variant="outline" size="sm"
                onClick={() => copyToClipboard(newPassword, 'password')}
              >
                {copied === 'password' ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
            <p className="text-xs text-gray-500 mt-1">Auto-generated passphrase. Click refresh for a new one.</p>
          </div>

          {error && (
            <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 rounded-lg p-3">
              <AlertCircle className="h-4 w-4 flex-shrink-0" />
              {error}
            </div>
          )}

          <Button
            onClick={handleReset}
            disabled={isResetting || !selectedAdmin}
            className="bg-indigo-600 hover:bg-indigo-700 text-white"
          >
            {isResetting ? (
              <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Resetting...</>
            ) : resetDone ? (
              <><Check className="h-4 w-4 mr-2" /> Password Reset!</>
            ) : (
              <><KeyRound className="h-4 w-4 mr-2" /> Reset Password</>
            )}
          </Button>

          {resetDone && (
            <div className="rounded-lg border border-green-200 bg-green-50 p-3">
              <p className="text-sm text-green-800 font-medium">
                Password reset successfully for <strong>{selectedAdmin}</strong>.
                Copy the email template below to send credentials.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Email Template */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Mail className="h-5 w-5 text-gray-500" />
            Email Template
            <span className="text-xs font-normal text-gray-400 ml-2">Copy and paste into your email</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="relative">
            <pre className="bg-gray-50 border rounded-lg p-4 text-sm text-gray-800 whitespace-pre-wrap font-sans leading-relaxed">
              {emailTemplate}
            </pre>
            <Button
              variant="outline" size="sm"
              className="absolute top-3 right-3"
              onClick={() => copyToClipboard(emailTemplate, 'email')}
            >
              {copied === 'email' ? (
                <><Check className="h-4 w-4 mr-1 text-green-600" /> Copied!</>
              ) : (
                <><Copy className="h-4 w-4 mr-1" /> Copy All</>
              )}
            </Button>
          </div>

          {/* Quick copy fields */}
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: 'Login URL', value: data.loginUrl, icon: Globe },
              { label: 'Username', value: selectedAdmin, icon: User },
              { label: 'Password', value: newPassword, icon: KeyRound },
            ].map(({ label, value, icon: Icon }) => (
              <button
                key={label}
                onClick={() => copyToClipboard(value, label)}
                className="flex items-center gap-2 p-3 rounded-lg border bg-white hover:bg-gray-50 transition-colors text-left group"
              >
                <Icon className="h-4 w-4 text-gray-400 group-hover:text-indigo-500" />
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-gray-500">{label}</p>
                  <p className="text-sm font-mono text-gray-900 truncate">{value}</p>
                </div>
                {copied === label ? (
                  <Check className="h-4 w-4 text-green-600 flex-shrink-0" />
                ) : (
                  <Copy className="h-4 w-4 text-gray-300 group-hover:text-gray-500 flex-shrink-0" />
                )}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
