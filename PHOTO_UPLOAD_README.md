# Challenge Photo Upload Feature

## Overview
This feature allows users to upload profile photos when creating challenges, and admins to manage these photos after creation.

## Features

### 1. Photo Upload During Challenge Creation
- Users can upload a photo when creating a new challenge
- Supported formats: JPG, PNG, GIF
- Maximum file size: 5MB
- Photo preview before upload
- Option to remove selected photo before submission

### 2. Admin Photo Management
- Challenge admins can update the challenge photo at any time
- Admins can delete existing photos
- Admin-only access control
- Real-time photo updates

### 3. Photo Display
- Challenge photos are displayed in challenge cards
- Fallback to default icon when no photo is available
- Responsive image display with proper error handling

## Technical Implementation

### Backend Changes

#### 1. Challenge Model Update
- Added `photo` field to store photo URL
- Field type: String (stores file path)

#### 2. File Upload Middleware (`middleware/upload.js`)
- Uses Multer for file handling
- Configures storage to `uploads/challenges/` directory
- File filtering for images only
- 5MB file size limit
- Unique filename generation

#### 3. New API Endpoints
- `POST /api/challenge/:challengeId/photo` - Upload new photo
- `PUT /api/challenge/:challengeId/photo` - Update photo (admin only)
- `DELETE /api/challenge/:challengeId/photo` - Delete photo (admin only)

#### 4. Static File Serving
- Added `/uploads` route to serve uploaded files
- Photos accessible via `/uploads/challenges/filename.ext`

### Frontend Changes

#### 1. ChallengeForm Component
- Added photo upload field with preview
- File validation and error handling
- Photo upload after challenge creation
- Graceful fallback if photo upload fails

#### 2. ChallengePhotoManager Component
- Admin interface for photo management
- Upload, update, and delete functionality
- Real-time preview and validation
- Admin permission verification

#### 3. Chat Page Updates
- Challenge cards now display photos
- Fallback icons for challenges without photos
- Consistent layout with photo integration

## Setup Requirements

### 1. Install Dependencies
```bash
cd fitapp-backend
npm install multer
```

### 2. Create Upload Directory
```bash
mkdir -p uploads/challenges
```

### 3. Ensure Proper Permissions
- Backend container needs write access to uploads directory
- Frontend needs access to backend API for photo serving

## Usage

### For Challenge Creators
1. Fill out challenge creation form
2. Click "Choose File" to select a photo
3. Preview the selected photo
4. Submit the form (photo uploads automatically)

### For Challenge Admins
1. Access challenge management interface
2. Use "Manage Photo" option
3. Upload new photo or delete existing one
4. Changes apply immediately

## Security Features

- Admin-only access control for photo updates
- File type validation (images only)
- File size limits (5MB max)
- Secure file naming (prevents path traversal)
- Automatic cleanup of old files

## Error Handling

- Graceful fallback for missing photos
- User-friendly error messages
- Photo upload failures don't prevent challenge creation
- Automatic cleanup on failed uploads

## Future Enhancements

- Image compression and optimization
- Multiple photo support
- Photo cropping and editing
- Cloud storage integration
- CDN support for better performance
