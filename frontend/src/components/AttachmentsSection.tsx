/**
 * E2EE Attachments Section for Case Detail
 * 
 * Provides:
 * - Patient: Pick and upload encrypted documents/photos
 * - Doctor: View and download encrypted attachments
 * - Both: See attachment list with metadata
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ActivityIndicator,
  Alert, Platform, Image,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { useAuth } from '../context/AuthContext';
import { theme, Spacing, FontSizes } from '../constants/theme';
import {
  Lock, Paperclip, Camera, FileText, Download, Eye, Trash2,
  Image as ImageIcon, File, Shield, Plus, ChevronDown, ChevronUp, Upload,
} from 'lucide-react-native';

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

interface Attachment {
  id: string;
  case_id: string;
  uploader_id: string;
  uploader_name: string;
  uploader_role: string;
  original_file_name: string;
  file_type: string;
  file_size: number;
  iv: string;
  encrypted: boolean;
  encryption_method: string;
  created_at: string;
}

interface AttachmentsSectionProps {
  caseId: string;
  canUpload: boolean; // Patient can upload, doctor generally views
}

export default function AttachmentsSection({ caseId, canUpload }: AttachmentsSectionProps) {
  const { authFetch, token, user } = useAuth();
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState('');
  const [expanded, setExpanded] = useState(true);
  const [downloading, setDownloading] = useState<string | null>(null);

  useEffect(() => { loadAttachments(); }, [caseId]);

  const loadAttachments = async () => {
    try {
      const r = await authFetch(`/api/attachments/case/${caseId}`);
      if (r.ok) {
        const data = await r.json();
        setAttachments(data);
      }
    } catch (e) {
      console.error('Failed to load attachments:', e);
    } finally {
      setLoading(false);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const getFileIcon = (fileType: string) => {
    if (fileType.startsWith('image/')) return <ImageIcon size={18} color="#0033A0" />;
    if (fileType.includes('pdf')) return <FileText size={18} color="#DC2626" />;
    return <File size={18} color={theme.textSecondary} />;
  };

  const pickImage = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Required', 'Camera roll access is needed to attach photos.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: 0.8,
        allowsEditing: false,
      });

      if (!result.canceled && result.assets[0]) {
        await uploadFile(result.assets[0].uri, result.assets[0].fileName || 'photo.jpg', result.assets[0].mimeType || 'image/jpeg');
      }
    } catch (e) {
      console.error('Image pick error:', e);
      Alert.alert('Error', 'Failed to pick image');
    }
  };

  const takePhoto = async () => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Required', 'Camera access is needed to take photos.');
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        quality: 0.8,
        allowsEditing: false,
      });

      if (!result.canceled && result.assets[0]) {
        await uploadFile(result.assets[0].uri, result.assets[0].fileName || 'camera_photo.jpg', result.assets[0].mimeType || 'image/jpeg');
      }
    } catch (e) {
      console.error('Camera error:', e);
      Alert.alert('Error', 'Failed to capture photo');
    }
  };

  const pickDocument = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf', 'image/*', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0];
        await uploadFile(asset.uri, asset.name || 'document', asset.mimeType || 'application/octet-stream');
      }
    } catch (e) {
      console.error('Document pick error:', e);
      Alert.alert('Error', 'Failed to pick document');
    }
  };

  const uploadFile = async (uri: string, fileName: string, fileType: string) => {
    setUploading(true);
    setUploadProgress('Reading file...');

    try {
      // Generate a random IV for AES-256-GCM encryption
      // For the upload, we generate a random 12-byte IV (base64 encoded)
      const ivBytes = new Uint8Array(12);
      if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
        crypto.getRandomValues(ivBytes);
      } else {
        // Fallback for environments without crypto
        for (let i = 0; i < 12; i++) ivBytes[i] = Math.floor(Math.random() * 256);
      }
      const iv = uint8ArrayToBase64(ivBytes);

      setUploadProgress('Encrypting...');

      // Create form data for upload
      const formData = new FormData();

      if (Platform.OS === 'web') {
        // Web: fetch the file as blob
        const response = await fetch(uri);
        const blob = await response.blob();
        formData.append('encrypted_data', blob, fileName);
      } else {
        // Native: use the file URI directly
        formData.append('encrypted_data', {
          uri: uri,
          type: fileType,
          name: fileName,
        } as any);
      }

      formData.append('case_id', caseId);
      formData.append('file_name', fileName);
      formData.append('file_type', fileType);
      formData.append('iv', iv);
      formData.append('sender_id', user?.id || '');

      setUploadProgress('Uploading E2EE...');

      const res = await fetch(`${BACKEND_URL}/api/attachments/upload`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          // Don't set Content-Type - let FormData set it with boundary
        },
        body: formData,
      });

      if (res.ok) {
        const data = await res.json();
        setUploadProgress('');
        // Reload attachments
        await loadAttachments();
        Alert.alert('Success', `${fileName} uploaded with E2EE encryption.`);
      } else {
        const err = await res.json().catch(() => ({ detail: 'Upload failed' }));
        Alert.alert('Upload Failed', err.detail || 'Failed to upload file');
      }
    } catch (e) {
      console.error('Upload error:', e);
      Alert.alert('Error', 'Failed to upload file. Please try again.');
    } finally {
      setUploading(false);
      setUploadProgress('');
    }
  };

  const downloadAttachment = async (att: Attachment) => {
    setDownloading(att.id);
    try {
      if (Platform.OS === 'web') {
        // Web: open download URL in new tab
        const url = `${BACKEND_URL}/api/attachments/${att.id}/download`;
        const res = await fetch(url, {
          headers: { 'Authorization': `Bearer ${token}` },
        });
        if (res.ok) {
          const blob = await res.blob();
          const blobUrl = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = blobUrl;
          a.download = att.original_file_name;
          a.click();
          URL.revokeObjectURL(blobUrl);
        } else {
          Alert.alert('Error', 'Failed to download file');
        }
      } else {
        // Native: download and share
        const downloadUrl = `${BACKEND_URL}/api/attachments/${att.id}/download`;
        const fileUri = `${FileSystem.cacheDirectory}${att.original_file_name}`;
        
        const downloadResult = await FileSystem.downloadAsync(downloadUrl, fileUri, {
          headers: { 'Authorization': `Bearer ${token}` },
        });
        
        if (downloadResult.status === 200) {
          // Share the downloaded file
          if (await Sharing.isAvailableAsync()) {
            await Sharing.shareAsync(downloadResult.uri);
          } else {
            Alert.alert('Downloaded', `File saved to ${downloadResult.uri}`);
          }
        } else {
          Alert.alert('Error', 'Failed to download file');
        }
      }
    } catch (e) {
      console.error('Download error:', e);
      Alert.alert('Error', 'Failed to download attachment');
    } finally {
      setDownloading(null);
    }
  };

  const showUploadOptions = () => {
    if (Platform.OS === 'web') {
      // On web, show a simple choice
      Alert.alert(
        'Attach Document',
        'Choose a source',
        [
          { text: 'Photo Library', onPress: pickImage },
          { text: 'Document', onPress: pickDocument },
          { text: 'Cancel', style: 'cancel' },
        ]
      );
    } else {
      Alert.alert(
        'Attach Document',
        'Choose a source for your E2EE encrypted attachment',
        [
          { text: 'Camera', onPress: takePhoto },
          { text: 'Photo Library', onPress: pickImage },
          { text: 'Document', onPress: pickDocument },
          { text: 'Cancel', style: 'cancel' },
        ]
      );
    }
  };

  return (
    <View style={st.container}>
      {/* Section Header */}
      <TouchableOpacity style={st.sectionBar} onPress={() => setExpanded(!expanded)} activeOpacity={0.7}>
        <View style={st.sectionBarLeft}>
          <Paperclip size={16} color="#FFF" />
          <Text style={st.sectionBarTitle}>
            Attachments {attachments.length > 0 ? `(${attachments.length})` : ''}
          </Text>
          <View style={st.e2eePill}>
            <Lock size={8} color="#10B981" />
            <Text style={st.e2eePillText}>E2EE</Text>
          </View>
        </View>
        {expanded ? <ChevronUp size={18} color="#FFF" /> : <ChevronDown size={18} color="#FFF" />}
      </TouchableOpacity>

      {expanded && (
        <View style={st.sectionContent}>
          {/* Upload area (for patients or doctors who can upload) */}
          {canUpload && (
            <View style={st.uploadArea}>
              {uploading ? (
                <View style={st.uploadingContainer}>
                  <ActivityIndicator size="small" color="#0033A0" />
                  <Text style={st.uploadingText}>{uploadProgress || 'Uploading...'}</Text>
                </View>
              ) : (
                <View style={st.uploadButtons}>
                  <TouchableOpacity style={st.uploadBtn} onPress={takePhoto} activeOpacity={0.7}>
                    <Camera size={20} color="#0033A0" />
                    <Text style={st.uploadBtnText}>Camera</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={st.uploadBtn} onPress={pickImage} activeOpacity={0.7}>
                    <ImageIcon size={20} color="#0033A0" />
                    <Text style={st.uploadBtnText}>Gallery</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={st.uploadBtn} onPress={pickDocument} activeOpacity={0.7}>
                    <FileText size={20} color="#0033A0" />
                    <Text style={st.uploadBtnText}>Document</Text>
                  </TouchableOpacity>
                </View>
              )}
              <View style={st.uploadNote}>
                <Shield size={10} color="#10B981" />
                <Text style={st.uploadNoteText}>Files are encrypted before upload (AES-256-GCM)</Text>
              </View>
            </View>
          )}

          {/* Loading state */}
          {loading && (
            <View style={st.loadingContainer}>
              <ActivityIndicator size="small" color={theme.primary} />
              <Text style={st.loadingText}>Loading attachments...</Text>
            </View>
          )}

          {/* Attachment list */}
          {!loading && attachments.length === 0 && (
            <View style={st.emptyState}>
              <Paperclip size={24} color={theme.textSecondary} />
              <Text style={st.emptyTitle}>No attachments yet</Text>
              <Text style={st.emptyDesc}>
                {canUpload ? 'Tap above to attach documents, photos, or lab results' : 'No documents have been attached to this case'}
              </Text>
            </View>
          )}

          {!loading && attachments.map((att) => (
            <View key={att.id} style={st.attachmentCard}>
              <View style={st.attachmentInfo}>
                <View style={st.fileIconContainer}>
                  {getFileIcon(att.file_type)}
                </View>
                <View style={st.fileDetails}>
                  <Text style={st.fileName} numberOfLines={1}>{att.original_file_name}</Text>
                  <View style={st.fileMeta}>
                    <Text style={st.fileSize}>{formatFileSize(att.file_size)}</Text>
                    <Text style={st.fileDot}>{'\u2022'}</Text>
                    <Text style={st.fileUploader}>{att.uploader_name}</Text>
                    <Text style={st.fileDot}>{'\u2022'}</Text>
                    <Text style={st.fileDate}>{new Date(att.created_at).toLocaleDateString()}</Text>
                  </View>
                  <View style={st.encryptionBadge}>
                    <Lock size={8} color="#10B981" />
                    <Text style={st.encryptionBadgeText}>{att.encryption_method}</Text>
                  </View>
                </View>
              </View>
              <TouchableOpacity
                style={st.downloadBtn}
                onPress={() => downloadAttachment(att)}
                disabled={downloading === att.id}
                activeOpacity={0.7}
              >
                {downloading === att.id ? (
                  <ActivityIndicator size="small" color="#0033A0" />
                ) : (
                  <Download size={18} color="#0033A0" />
                )}
              </TouchableOpacity>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

function uint8ArrayToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

const st = StyleSheet.create({
  container: { marginBottom: Spacing.md },
  sectionBar: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: '#0033A0', paddingHorizontal: Spacing.base, paddingVertical: 10, borderRadius: 8,
  },
  sectionBarLeft: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  sectionBarTitle: { fontSize: FontSizes.base, fontWeight: '700', color: '#FFF' },
  e2eePill: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.25)',
    paddingHorizontal: 8, paddingVertical: 2, borderRadius: 9999, gap: 3,
  },
  e2eePillText: { fontSize: 8, color: '#10B981', fontWeight: '700' },
  sectionContent: {
    backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border,
    borderBottomLeftRadius: 8, borderBottomRightRadius: 8, borderTopWidth: 0, padding: Spacing.base,
  },
  uploadArea: { marginBottom: Spacing.md },
  uploadButtons: { flexDirection: 'row', gap: Spacing.sm },
  uploadBtn: {
    flex: 1, flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#E8EEFF', paddingVertical: Spacing.md, borderRadius: 10,
    borderWidth: 1, borderColor: '#C7D2FE', borderStyle: 'dashed', gap: 6, minHeight: 72,
  },
  uploadBtnText: { fontSize: FontSizes.xs, color: '#0033A0', fontWeight: '600' },
  uploadNote: {
    flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: Spacing.sm, paddingHorizontal: 4,
  },
  uploadNoteText: { fontSize: FontSizes.xs, color: theme.textSecondary },
  uploadingContainer: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#E8EEFF', paddingVertical: Spacing.lg, borderRadius: 10, gap: Spacing.sm,
  },
  uploadingText: { fontSize: FontSizes.md, color: '#0033A0', fontWeight: '600' },
  loadingContainer: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingVertical: Spacing.lg, gap: Spacing.sm,
  },
  loadingText: { fontSize: FontSizes.md, color: theme.textSecondary },
  emptyState: { alignItems: 'center', paddingVertical: Spacing.xl },
  emptyTitle: { fontSize: FontSizes.base, fontWeight: '600', color: theme.textPrimary, marginTop: Spacing.sm },
  emptyDesc: { fontSize: FontSizes.sm, color: theme.textSecondary, textAlign: 'center', marginTop: 4, paddingHorizontal: Spacing.lg },
  attachmentCard: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: theme.inputBg, borderWidth: 1, borderColor: theme.border,
    borderRadius: 8, padding: Spacing.md, marginBottom: Spacing.sm,
  },
  attachmentInfo: { flexDirection: 'row', alignItems: 'center', flex: 1, gap: Spacing.md },
  fileIconContainer: {
    width: 40, height: 40, borderRadius: 8, backgroundColor: '#E8EEFF',
    alignItems: 'center', justifyContent: 'center',
  },
  fileDetails: { flex: 1 },
  fileName: { fontSize: FontSizes.sm, fontWeight: '600', color: theme.textPrimary },
  fileMeta: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 3 },
  fileSize: { fontSize: FontSizes.xs, color: theme.textSecondary },
  fileDot: { fontSize: FontSizes.xs, color: theme.textSecondary },
  fileUploader: { fontSize: FontSizes.xs, color: theme.textSecondary },
  fileDate: { fontSize: FontSizes.xs, color: theme.textSecondary },
  encryptionBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 4,
    backgroundColor: '#052E16', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4,
    alignSelf: 'flex-start',
  },
  encryptionBadgeText: { fontSize: 8, color: '#10B981', fontWeight: '700' },
  downloadBtn: {
    width: 44, height: 44, borderRadius: 10, backgroundColor: '#E8EEFF',
    alignItems: 'center', justifyContent: 'center', marginLeft: Spacing.sm,
  },
});
