  export type ViewState = 'LANDING' | 'UPLOAD' | 'PROCESSING' | 'SUCCESS' | 'CONSOLE' | 'CITIZEN_DASHBOARD';

  export interface Incident {
    id: string;
    trackingId: string;
    type: 'Helmet Violations' | 'Potholes' | 'Other';
    title: string;
    time: string;
    date: string;
    severity: 'High' | 'Medium' | 'Low';
    confidence: number;
    licensePlate: string;
    location: string;
    status: 'Pending' | 'Verified' | 'Rejected';
    aiAnalysis: string;
    videoUrl: string;
    thumbnailUrl: string;
    evidenceUrl: string;
    rewardCr: number;
    timestampSeconds?: number | null;
    ocrConfidence?: number | null;
  }

  export interface SubmissionSummary {
    trackingId: string | null;
    submittedAt: string;
    incidentCount: number;
    rewardCredits: number;
    governmentResponse: string;
    deliveryMode: 'government' | 'mock';
    reportText: string | null;
  }

  export interface DashboardStats {
    submitted: number;
    verified: number;
    pending: number;
    rejected: number;
    rewards: number;
    riskIndex: number;
    safetyScore: number;
    routesAnalyzed: number;
  }
