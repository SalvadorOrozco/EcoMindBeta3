import { createContext, useContext, useEffect, useMemo, useState } from 'react';

const CompanyContext = createContext();

export function CompanyProvider({ children }) {
  const [company, setCompany] = useState(null);
  const [period, setPeriod] = useState('2024');
  const [reportScope, setReportScope] = useState('empresa');
  const [selectedPlant, setSelectedPlant] = useState(null);

  useEffect(() => {
    setSelectedPlant(null);
  }, [company?.id]);

  const value = useMemo(
    () => ({
      company,
      setCompany,
      period,
      setPeriod,
      reportScope,
      setReportScope,
      selectedPlant,
      setSelectedPlant,
    }),
    [company, period, reportScope, selectedPlant],
  );

  return <CompanyContext.Provider value={value}>{children}</CompanyContext.Provider>;
}

export function useCompany() {
  const context = useContext(CompanyContext);
  if (!context) {
    throw new Error('useCompany debe utilizarse dentro de CompanyProvider');
  }
  return context;
}
