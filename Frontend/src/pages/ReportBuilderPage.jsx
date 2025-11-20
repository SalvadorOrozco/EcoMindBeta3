import { useState } from 'react';
import CompanySelector from '../components/CompanySelector.jsx';
import MetricForm from '../components/MetricForm.jsx';
import LoadingIndicator from '../components/LoadingIndicator.jsx';
import { generateReport } from '../services/api.js';
import { useCompany } from '../context/CompanyContext.jsx';
import PlantSelector from '../components/PlantSelector.jsx';
import FileUploader from '../components/FileUploader.jsx';

export default function ReportBuilderPage() {
  const { company, period, reportScope, setReportScope, selectedPlant, setSelectedPlant } = useCompany();
  const [generating, setGenerating] = useState(false);
  const [message, setMessage] = useState(null);

  async function handleGenerate() {
    if (!company) {
      setMessage('Selecciona una empresa para generar el reporte.');
      return;
    }
    if (reportScope === 'planta' && !selectedPlant) {
      setMessage('Selecciona una planta para generar el reporte.');
      return;
    }
    setGenerating(true);
    try {
      const payload = {
        empresaId: company.id,
        periodo: period,
        alcance: reportScope,
      };
      if (reportScope === 'planta' && selectedPlant) {
        payload.plantaId = selectedPlant.id;
      }
      const pdfBlob = await generateReport(payload);
      const url = window.URL.createObjectURL(pdfBlob);
      const link = document.createElement('a');
      link.href = url;
      const scopeSuffix = reportScope === 'planta' && selectedPlant ? `-Planta-${selectedPlant.name}` : '';
      link.download = `Reporte-ESG-${company.name}${scopeSuffix}-${period}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      setMessage('Reporte generado correctamente.');
    } catch (error) {
      setMessage(error.message ?? 'No se pudo generar el reporte.');
    } finally {
      setGenerating(false);
    }
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h2>Reportes ESG</h2>
          <p>Carga indicadores, deja que la IA redacte el resumen y descarga el PDF.</p>
        </div>
        <button className="primary-button" type="button" onClick={handleGenerate} disabled={generating}>
          {generating ? 'Generando...' : 'Generar PDF ESG'}
        </button>
      </div>

      <CompanySelector />
      <fieldset className="report-scope-toggle" disabled={generating}>
        <legend className="sr-only">Alcance del reporte a generar</legend>
        <label>
          <input
            type="radio"
            name="reportScope"
            value="empresa"
            checked={reportScope === 'empresa'}
            onChange={() => setReportScope('empresa')}
          />
          Reporte general (empresa)
        </label>
        <label>
          <input
            type="radio"
            name="reportScope"
            value="planta"
            checked={reportScope === 'planta'}
            onChange={() => setReportScope('planta')}
          />
          Reporte por planta
        </label>
      </fieldset>
      {reportScope === 'planta' && (
        <PlantSelector
          companyId={company?.id}
          value={selectedPlant}
          onChange={setSelectedPlant}
          helper="Selecciona la planta a incluir en el reporte."
        />
      )}
      {message && <div className="alert">{message}</div>}
      {generating && <LoadingIndicator label="Construyendo reporte con IA..." />}

      {reportScope === 'empresa' && (
        <>
          <MetricForm type="environmental" />
          <MetricForm type="social" />
          <MetricForm type="governance" />
        </>
      )}
      {reportScope === 'planta' && (
        <div className="card">
          <p>
            Los reportes por planta utilizan los indicadores personalizados asociados a la planta seleccionada. Puedes administrar
            estos indicadores desde el módulo de indicadores personalizados.
          </p>
        </div>
      )}

      <FileUploader companyId={company?.id} period={period} />
    </div>
  );
}
