# User Management System Implementation

## Backend Architecture

### User Controller (`backend/src/controllers/userController.ts`)
Comprehensive user management with CRUD operations, role-based access, and profile management:

```typescript
// Get paginated users with search and filters
export const getUsers = async (req: AuthRequest, res: Response) => {
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 25;
  const search = req.query.search as string;
  const role = req.query.role as string;
  const isActive = req.query.isActive as string;
  
  // Build where clause for filtering
  const where: any = {};
  if (search) {
    where.OR = [
      { firstName: { contains: search, mode: 'insensitive' } },
      { lastName: { contains: search, mode: 'insensitive' } },
      { email: { contains: search, mode: 'insensitive' } },
      { username: { contains: search, mode: 'insensitive' } },
    ];
  }
  if (role) where.role = role;
  if (isActive !== undefined) where.isActive = isActive === 'true';
  
  // Get users with counts
  const users = await prisma.user.findMany({
    where,
    skip: (page - 1) * limit,
    take: limit,
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      username: true,
      role: true,
      isActive: true,
      lastLoginDate: true,
      _count: {
        select: {
          createdContacts: true,
          createdCampaigns: true,
        },
      },
    },
  });
};

// Create user with role assignment
export const createUser = async (req: AuthRequest, res: Response) => {
  const validatedData = createUserSchema.parse(req.body);
  
  // Check for duplicates
  const existingUser = await prisma.user.findFirst({
    where: {
      OR: [
        { email: validatedData.email },
        { username: validatedData.username },
      ],
    },
  });
  
  if (existingUser) {
    res.status(400).json({ error: 'User already exists' });
    return;
  }
  
  // Hash password and create user
  const hashedPassword = await hashPassword(validatedData.password);
  const user = await prisma.user.create({
    data: { ...validatedData, password: hashedPassword },
  });
};

// Change password with verification
export const changePassword = async (req: AuthRequest, res: Response) => {
  const { currentPassword, newPassword } = req.body;
  const user = await prisma.user.findUnique({ where: { id: req.user!.id } });
  
  // Verify current password
  const isValid = await comparePassword(currentPassword, user.password);
  if (!isValid) {
    res.status(400).json({ error: 'Current password is incorrect' });
    return;
  }
  
  // Update password
  const hashedPassword = await hashPassword(newPassword);
  await prisma.user.update({
    where: { id: req.user!.id },
    data: { password: hashedPassword },
  });
};
```

### User Routes (`backend/src/routes/userRoutes.ts`)
Role-based route protection:

```typescript
// All routes require authentication
router.use(authenticate);

// Public routes (all authenticated users)
router.get('/me', getCurrentUser);
router.patch('/me/profile', updateProfile);
router.post('/me/change-password', changePassword);

// Manager/Admin routes
router.get('/stats', authorize(['MANAGER', 'ADMIN']), getUserStats);
router.get('/', authorize(['MANAGER', 'ADMIN']), getUsers);
router.get('/:id', authorize(['MANAGER', 'ADMIN']), getUserById);

// Admin-only routes
router.post('/', authorize(['ADMIN']), createUser);
router.patch('/:id', authorize(['ADMIN']), updateUser);
router.delete('/:id', authorize(['ADMIN']), deleteUser);
```

## Frontend Components

### Users List Page (`frontend/src/pages/Users.tsx`)
Comprehensive user management interface:

```typescript
// Fetch users with filters
const { data: usersData } = useQuery({
  queryKey: ['users', page, rowsPerPage, search, roleFilter, statusFilter],
  queryFn: async () => {
    const params = new URLSearchParams({
      page: String(page + 1),
      limit: String(rowsPerPage),
    });
    if (search) params.append('search', search);
    if (roleFilter) params.append('role', roleFilter);
    if (statusFilter) params.append('isActive', statusFilter);
    
    const response = await api.get(`/users?${params.toString()}`);
    return response.data;
  },
});

// Delete (deactivate) mutation
const deleteMutation = useMutation({
  mutationFn: async (userId: string) => {
    await api.delete(`/users/${userId}`);
  },
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['users'] });
    queryClient.invalidateQueries({ queryKey: ['user-stats'] });
  },
});

// Role-based chip colors
const getRoleColor = (role: string) => {
  switch (role) {
    case 'ADMIN': return 'error';
    case 'MANAGER': return 'warning';
    case 'USER': return 'primary';
    case 'VIEWER': return 'default';
  }
};
```

### User Form (`frontend/src/pages/UserForm.tsx`)
Create/edit user with validation:

```typescript
// Fetch user for editing
const { data: userData } = useQuery({
  queryKey: ['user', id],
  queryFn: async () => {
    const response = await api.get(`/users/${id}`);
    return response.data.data;
  },
  enabled: isEdit,
});

// Create/Update mutation
const mutation = useMutation({
  mutationFn: async (data: UserFormData) => {
    if (isEdit) {
      const { password, ...updateData } = data;
      await api.patch(`/users/${id}`, updateData);
    } else {
      await api.post('/users', data);
    }
  },
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['users'] });
    navigate('/users');
  },
});

// Form validation with react-hook-form
const { control, handleSubmit, formState: { errors } } = useForm({
  defaultValues: {
    firstName: '',
    lastName: '',
    email: '',
    username: '',
    password: '',
    role: 'USER',
    isActive: true,
  },
});
```

### Settings Page (`frontend/src/pages/Settings.tsx`)
Profile and password management:

```typescript
// Update profile mutation
const profileMutation = useMutation({
  mutationFn: async (data: ProfileFormData) => {
    await api.patch('/users/me/profile', data);
  },
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['current-user'] });
    queryClient.invalidateQueries({ queryKey: ['auth-user'] });
    setProfileSuccess(true);
  },
});

// Change password mutation
const passwordMutation = useMutation({
  mutationFn: async (data: { currentPassword: string; newPassword: string }) => {
    await api.post('/users/me/change-password', data);
  },
  onSuccess: () => {
    resetPassword();
    setPasswordSuccess(true);
  },
});

// Password confirmation validation
<Controller
  name="confirmPassword"
  control={passwordControl}
  rules={{
    required: 'Please confirm your password',
    validate: (value) =>
      value === newPassword || 'Passwords do not match',
  }}
  render={({ field }) => (
    <TextField {...field} type="password" label="Confirm Password" />
  )}
/>
```

## Dashboard Layout Integration

### Role-Based Menu Filtering (`frontend/src/components/DashboardLayout.tsx`)

```typescript
// Menu items with role restrictions
const menuItems = [
  { text: 'Dashboard', icon: <DashboardIcon />, path: '/dashboard', roles: [] },
  { text: 'Contacts', icon: <PeopleIcon />, path: '/contacts', roles: [] },
  { text: 'Users', icon: <ManageAccountsIcon />, path: '/users', roles: ['ADMIN', 'MANAGER'] },
];

// Filter menu by user role
const drawer = (
  <List>
    {menuItems
      .filter((item) => 
        item.roles.length === 0 || 
        (user?.role && item.roles.includes(user.role))
      )
      .map((item) => (
        <ListItemButton selected={location.pathname === item.path}>
          <ListItemIcon>{item.icon}</ListItemIcon>
          <ListItemText primary={item.text} />
        </ListItemButton>
      ))}
  </List>
);

// Profile menu with settings
<Menu anchorEl={anchorEl} open={Boolean(anchorEl)}>
  <MenuItem onClick={() => navigate('/settings')}>
    <ListItemIcon><SettingsIcon /></ListItemIcon>
    Settings
  </MenuItem>
  <Divider />
  <MenuItem onClick={handleLogout}>
    <ListItemIcon><Logout /></ListItemIcon>
    Logout
  </MenuItem>
</Menu>
```

## Key Security Features

1. **Password Security**: Bcrypt hashing, 8+ character requirement, current password verification
2. **Role-Based Access**: Route protection with `authorize` middleware
3. **Self-Protection**: Users can't delete themselves or change their own role
4. **Duplicate Prevention**: Email and username uniqueness validation
5. **Soft Delete**: Deactivation instead of hard delete preserves data integrity

## API Endpoints

- `GET /api/v1/users/me` - Current user profile
- `PATCH /api/v1/users/me/profile` - Update profile
- `POST /api/v1/users/me/change-password` - Change password
- `GET /api/v1/users/stats` - User statistics (MANAGER+)
- `GET /api/v1/users` - List users (MANAGER+)
- `GET /api/v1/users/:id` - Get user (MANAGER+)
- `POST /api/v1/users` - Create user (ADMIN)
- `PATCH /api/v1/users/:id` - Update user (ADMIN)
- `DELETE /api/v1/users/:id` - Deactivate user (ADMIN)

## Routes

- `/users` - User list (ADMIN, MANAGER)
- `/users/new` - Create user (ADMIN)
- `/users/:id/edit` - Edit user (ADMIN)
- `/settings` - Account settings (all users)