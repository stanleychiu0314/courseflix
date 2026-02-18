import React, { useState, useEffect, useCallback } from 'react';
import Navbar from '../components/Navbar';
import '../styles/AdminSyllabiPage.css';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

interface Syllabus {
  id: string;
  file_name: string;
  file_size: number;
  status: 'pending' | 'approved' | 'rejected';
  uploaded_at: string;
  reviewed_at: string | null;
  rejection_reason: string | null;
  uploaded_by_name: string;
  uploaded_by_email: string;
  course_code: string;
  course_name: string;
  term_label: string;
  reviewed_by_name: string | null;
}

const AdminSyllabiPage: React.FC = () => {
  const [syllabi, setSyllabi] = useState<Syllabus[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('pending');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState<string | null>(null);

  const fetchSyllabi = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (statusFilter) params.append('status', statusFilter);
      params.append('page', String(currentPage));
      params.append('limit', '20');

      const response = await fetch(
        `${API_BASE_URL}/api/admin/syllabi?${params.toString()}`,
        { credentials: 'include' }
      );

      if (!response.ok) {
        if (response.status === 403) throw new Error('Admin access required');
        throw new Error('Failed to fetch syllabi');
      }

      const data = await response.json();
      setSyllabi(data.syllabi);
      setTotalPages(data.pagination.totalPages);
      setTotalCount(data.pagination.totalCount);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error loading syllabi');
    } finally {
      setLoading(false);
    }
  }, [statusFilter, currentPage]);

  useEffect(() => {
    fetchSyllabi();
  }, [fetchSyllabi]);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const handlePreview = async (syllabus: Syllabus) => {
    setPreviewLoading(syllabus.id);
    try {
      const res = await fetch(
        `${API_BASE_URL}/api/admin/syllabi/${syllabus.id}/preview`,
        { credentials: 'include' }
      );
      if (!res.ok) throw new Error('Failed to load preview');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      setPreviewUrl(url);
    } catch {
      alert('Failed to load syllabus preview');
    } finally {
      setPreviewLoading(null);
    }
  };

  const handleClosePreview = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
  };

  const handleApprove = async (id: string) => {
    setActionLoading(id);
    try {
      const response = await fetch(
        `${API_BASE_URL}/api/admin/syllabi/${id}/approve`,
        { method: 'PATCH', credentials: 'include' }
      );
      if (!response.ok) throw new Error('Failed to approve');
      await fetchSyllabi();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to approve');
    } finally {
      setActionLoading(null);
    }
  };

  const handleReject = async (id: string) => {
    if (!rejectionReason.trim()) {
      alert('Please provide a rejection reason.');
      return;
    }
    setActionLoading(id);
    try {
      const response = await fetch(
        `${API_BASE_URL}/api/admin/syllabi/${id}/reject`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ reason: rejectionReason }),
        }
      );
      if (!response.ok) throw new Error('Failed to reject');
      setRejectingId(null);
      setRejectionReason('');
      await fetchSyllabi();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to reject');
    } finally {
      setActionLoading(null);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      year: 'numeric', month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  };

  return (
    <div className="admin-syllabi-page">
      <Navbar />
      <div className="admin-container">
        <div className="admin-header">
          <h1 className="admin-title">Syllabus Submissions</h1>
          <p className="admin-subtitle">
            Review and approve syllabus uploads ({totalCount} total)
          </p>
        </div>

        {/* Status filter tabs */}
        <div className="status-filters">
          {['pending', 'approved', 'rejected', ''].map((status) => (
            <button
              key={status || 'all'}
              className={`filter-tab ${statusFilter === status ? 'active' : ''}`}
              onClick={() => { setStatusFilter(status); setCurrentPage(1); }}
            >
              {status || 'All'}
            </button>
          ))}
        </div>

        {/* Content */}
        {loading ? (
          <div className="admin-loading">Loading submissions...</div>
        ) : error ? (
          <div className="admin-error">{error}</div>
        ) : syllabi.length === 0 ? (
          <div className="admin-empty">
            No {statusFilter || ''} syllabi submissions found.
          </div>
        ) : (
          <div className="syllabi-list">
            {syllabi.map((s) => (
              <div key={s.id} className={`syllabus-card status-${s.status}`}>
                <div className="syllabus-card-header">
                  <div className="syllabus-course-info">
                    <span className="course-badge">{s.course_code}</span>
                    <span className="course-name-text">{s.course_name}</span>
                    <span className="term-badge">{s.term_label}</span>
                  </div>
                  <span className={`status-badge ${s.status}`}>{s.status}</span>
                </div>

                <div className="syllabus-card-body">
                  <div className="syllabus-file-info">
                    <button
                      className="file-link"
                      onClick={() => handlePreview(s)}
                      disabled={previewLoading === s.id}
                    >
                      {previewLoading === s.id ? 'Loading...' : s.file_name}
                    </button>
                    <span className="file-size">{formatFileSize(s.file_size)}</span>
                  </div>
                  <div className="syllabus-meta">
                    <span>Uploaded by {s.uploaded_by_name} ({s.uploaded_by_email})</span>
                    <span>{formatDate(s.uploaded_at)}</span>
                  </div>
                  {s.reviewed_by_name && (
                    <div className="syllabus-review-info">
                      Reviewed by {s.reviewed_by_name} on {formatDate(s.reviewed_at!)}
                      {s.rejection_reason && (
                        <div className="rejection-reason">
                          Reason: {s.rejection_reason}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {s.status === 'pending' && (
                  <div className="syllabus-card-actions">
                    {rejectingId === s.id ? (
                      <div className="reject-form">
                        <input
                          type="text"
                          className="reject-reason-input"
                          placeholder="Reason for rejection..."
                          value={rejectionReason}
                          onChange={(e) => setRejectionReason(e.target.value)}
                        />
                        <button
                          className="action-btn reject-confirm-btn"
                          onClick={() => handleReject(s.id)}
                          disabled={actionLoading === s.id}
                        >
                          Confirm Reject
                        </button>
                        <button
                          className="action-btn cancel-btn"
                          onClick={() => { setRejectingId(null); setRejectionReason(''); }}
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <>
                        <button
                          className="action-btn approve-btn"
                          onClick={() => handleApprove(s.id)}
                          disabled={actionLoading === s.id}
                        >
                          {actionLoading === s.id ? 'Approving...' : 'Approve'}
                        </button>
                        <button
                          className="action-btn reject-btn"
                          onClick={() => setRejectingId(s.id)}
                          disabled={actionLoading === s.id}
                        >
                          Reject
                        </button>
                      </>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="admin-pagination">
            <button disabled={currentPage <= 1}
                    onClick={() => setCurrentPage(p => p - 1)}>
              Previous
            </button>
            <span>Page {currentPage} of {totalPages}</span>
            <button disabled={currentPage >= totalPages}
                    onClick={() => setCurrentPage(p => p + 1)}>
              Next
            </button>
          </div>
        )}

        {/* Preview Modal */}
        {previewUrl && (
          <div className="preview-overlay" onClick={handleClosePreview}>
            <div className="preview-content" onClick={(e) => e.stopPropagation()}>
              <div className="preview-header">
                <button className="preview-close-btn" onClick={handleClosePreview}>
                  Close
                </button>
              </div>
              <iframe
                src={previewUrl}
                title="Syllabus Preview"
                className="preview-iframe"
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminSyllabiPage;
