import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from "react";
import { getApplicants, type ApplicantSummary } from "../services/api";

interface ApplicantContextType {
  applicants: ApplicantSummary[];
  loading: boolean;
  error: string | null;
  selectedApplicant: ApplicantSummary | null;
  setSelectedApplicant: (applicant: ApplicantSummary | null) => void;
  selectCustomerById: (customerId: string) => ApplicantSummary | null;
  fetchApplicants: () => Promise<void>;
}

const ApplicantContext = createContext<ApplicantContextType | undefined>(
  undefined
);

export const ApplicantProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  const [applicants, setApplicants] = useState<ApplicantSummary[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedApplicant, setSelectedApplicant] =
    useState<ApplicantSummary | null>(null);

  const fetchApplicants = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getApplicants();
      setApplicants(data);
    } catch (err: any) {
      setError(err.message || "Failed to retrieve applicants from server");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchApplicants();
  }, [fetchApplicants]);

  const selectCustomerById = useCallback(
    (customerId: string): ApplicantSummary | null => {
      const found = applicants.find((a) => a.customer_id === customerId);
      if (found) {
        setSelectedApplicant(found);
        return found;
      }
      return null;
    },
    [applicants]
  );

  return (
    <ApplicantContext.Provider
      value={{
        applicants,
        loading,
        error,
        selectedApplicant,
        setSelectedApplicant,
        selectCustomerById,
        fetchApplicants,
      }}
    >
      {children}
    </ApplicantContext.Provider>
  );
};

export const useApplicant = (): ApplicantContextType => {
  const context = useContext(ApplicantContext);
  if (!context) {
    throw new Error("useApplicant must be used within an ApplicantProvider");
  }
  return context;
};
