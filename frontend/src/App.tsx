import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Layout } from "./components/Layout";
import { ApplicantsPage } from "./pages/ApplicantsPage";
import { AssessmentPage } from "./pages/AssessmentPage";

import { ApplicantProvider } from "./context/ApplicantContext";

export const App: React.FC = () => {
  return (
    <BrowserRouter>
      <ApplicantProvider>
        <Routes>
          <Route path="/" element={<Layout />}>
            <Route index element={<Navigate to="/applicants" replace />} />
            <Route path="applicants" element={<ApplicantsPage />} />
            <Route path="assessment" element={<AssessmentPage />} />
            <Route path="*" element={<Navigate to="/applicants" replace />} />
          </Route>
        </Routes>
      </ApplicantProvider>
    </BrowserRouter>
  );
};

export default App;
