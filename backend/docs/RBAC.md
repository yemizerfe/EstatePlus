# Role-Based Access Control (RBAC) System

## Overview

EstatePlus implements a comprehensive RBAC system with four main roles and granular permissions to ensure proper security and data access control.

## Roles

### 1. USER
**Default role for regular users**

**Permissions:**
- Browse public market information
- View properties/listings 
- View neighborhood statistics
- Save/unsave properties
- Manage personal saved properties
- Receive notifications
- Manage personal profile
- Create and view personal scenarios

**Use Case:** General public browsing the real estate market

### 2. PROPERTY_OWNER
**For users who want to list properties**

**Additional Permissions (extends USER):**
- Create property listings
- Edit own properties only
- Submit properties for approval
- View listing status and rejection reasons
- Create and manage own listings
- Update own property information

**Use Case:** Real estate owners, landlords, property developers

### 3. ANALYST
**For market analysts and researchers**

**Additional Permissions (extends USER):**
- Manage economic indicators (CRUD)
- Manage/import market data
- Create/update market statistics
- Run data-processing jobs
- Generate forecasts
- Create and manage market reports
- Create, update, delete scenarios
- Review analytics data
- Access AI-powered analysis tools
- Manage data sources

**Use Case:** Market researchers, real estate analysts, economists

### 4. ADMIN
**System administrators with full access**

**Permissions:**
- All permissions (denoted by '*')
- Manage users and roles
- Approve/reject property listings
- Access all system data
- View audit logs
- Manage system settings
- Administrative oversight

**Use Case:** System administrators, platform managers

## Permission Structure

Permissions follow the pattern: `resource:action`

Examples:
- `properties:read` - View properties
- `properties:create` - Create new properties
- `properties:update_own` - Update only own properties
- `market:write` - Modify market data
- `ai:use` - Access AI features

## Ownership-Based Access Control

The system implements ownership checks for sensitive resources:

### Properties
- **Property Owners:** Can only access/modify their own properties
- **Analysts:** Can view all properties (for market analysis)
- **Admins:** Full access to all properties

### Scenarios
- **Users/Property Owners:** Can only access their own scenarios
- **Analysts:** Can access all scenarios for market research
- **Admins:** Full access

### Reports
- **Analysts:** Can create and access reports they authored
- **Admins:** Full access to all reports
- **Users/Property Owners:** No access to reports

## Audit Logging

All significant actions are logged with:
- User ID and role
- Action performed
- Resource affected
- Timestamp
- IP address
- User agent
- Before/after data (for updates)

### Audited Actions Include:
- Authentication events (login, logout, failures)
- Property creation, approval, rejection
- Role changes
- Data imports
- Report generation
- Administrative actions

## Implementation

### Middleware Usage

```typescript
// Require specific role
router.get('/admin/users', authorize('admin'), getUsersHandler);

// Require specific permission
router.post('/properties', requirePermission('properties:create'), createPropertyHandler);

// Require ownership of resource
router.put('/properties/:id', requireResourceOwnership(getPropertyOwnerId), updatePropertyHandler);

// Combine role and permission checks
router.delete('/scenarios/:id', requireRoleAndPermission(['analyst', 'admin'], 'scenarios:delete'), deleteScenarioHandler);
```

### Permission Checks in Services

```typescript
import { PermissionsService } from '../services/permissions.service';

// Check permission programmatically
const canEdit = await PermissionsService.canPerform({
  userId: user.id,
  role: user.role,
  resource: 'properties',
  action: 'update',
  resourceId: propertyId
});

if (!canEdit) {
  throw new ForbiddenError('Cannot edit this property');
}
```

## Security Best Practices

1. **Server-Side Validation:** Never rely only on frontend role checks
2. **Principle of Least Privilege:** Users get minimum permissions needed
3. **Audit Trail:** All sensitive actions are logged
4. **Resource Ownership:** Users can only access their own resources (unless role permits otherwise)
5. **Role Hierarchy:** Higher roles inherit appropriate permissions
6. **Token Security:** JWTs are stored in HTTP-only cookies
7. **Session Management:** Proper token rotation and expiration

## Role Assignment

- **Registration:** Users can choose 'user' or 'property_owner' during signup
- **Role Elevation:** Only admins can promote users to 'analyst' or 'admin' roles
- **OAuth Users:** Default to 'user' role, complete onboarding to choose final role
- **No Self-Promotion:** Users cannot elevate their own privileges

## API Error Responses

**401 Unauthorized:**
```json
{
  "success": false,
  "message": "Authentication required"
}
```

**403 Forbidden:**
```json
{
  "success": false,
  "message": "Access denied. Required permission: properties:create"
}
```

**403 Ownership Error:**
```json
{
  "success": false,
  "message": "You can only access your own resources"
}
```