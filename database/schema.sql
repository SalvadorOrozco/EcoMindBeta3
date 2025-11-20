CREATE TABLE Empresas (
  EmpresaID INT IDENTITY PRIMARY KEY,
  Nombre NVARCHAR(100) NOT NULL,
  RUC NVARCHAR(20) NULL,
  Direccion NVARCHAR(200) NULL,
  Rubro NVARCHAR(100) NULL,
  FechaRegistro DATETIME DEFAULT GETDATE()
);

CREATE TABLE IndicadoresAmbientales (
  Id INT IDENTITY PRIMARY KEY,
  EmpresaID INT NOT NULL,
  Periodo NVARCHAR(10) NOT NULL,
  EnergiaKwh DECIMAL(18,2) NULL,
  PorcentajeRenovable DECIMAL(5,2) NULL,
  EmisionesCO2 DECIMAL(18,2) NULL,
  EmisionesAlcance1 DECIMAL(18,2) NULL,
  EmisionesAlcance2 DECIMAL(18,2) NULL,
  EmisionesAlcance3 DECIMAL(18,2) NULL,
  AguaM3 DECIMAL(18,2) NULL,
  AguaRecicladaPorc DECIMAL(5,2) NULL,
  AguaReutilizadaPorc DECIMAL(5,2) NULL,
  ResiduosPeligrososTon DECIMAL(18,2) NULL,
  ReciclajePorc DECIMAL(5,2) NULL,
  IntensidadEnergetica DECIMAL(18,2) NULL,
  ResiduosValorizadosPorc DECIMAL(5,2) NULL,
  IncidentesAmbientales INT NULL,
  SancionesAmbientales INT NULL,
  AuditoriasAmbientales INT NULL,
  PermisosAmbientalesAlDia BIT NULL,
  ProyectosBiodiversidad NVARCHAR(200) NULL,
  PlanMitigacionAmbiental NVARCHAR(200) NULL,
  FechaCarga DATETIME DEFAULT GETDATE(),
  FOREIGN KEY (EmpresaID) REFERENCES Empresas(EmpresaID)
);

CREATE TABLE IndicadoresSociales (
  Id INT IDENTITY PRIMARY KEY,
  EmpresaID INT NOT NULL,
  Periodo NVARCHAR(10) NOT NULL,
  PorcentajeMujeres DECIMAL(5,2) NULL,
  DiversidadGeneroPorc DECIMAL(5,2) NULL,
  HorasCapacitacion DECIMAL(18,2) NULL,
  AccidentesLaborales INT NULL,
  TasaFrecuenciaAccidentes DECIMAL(8,2) NULL,
  TasaRotacion DECIMAL(5,2) NULL,
  IndiceSatisfaccion DECIMAL(5,2) NULL,
  HorasVoluntariado DECIMAL(18,2) NULL,
  ProveedoresLocalesPorc DECIMAL(5,2) NULL,
  ParticipacionComunidad NVARCHAR(200) NULL,
  InversionComunidadUsd DECIMAL(18,2) NULL,
  ProgramasBienestarActivos INT NULL,
  SatisfaccionClientesPorc DECIMAL(5,2) NULL,
  EvaluacionesProveedoresSosteniblesPorc DECIMAL(5,2) NULL,
  CapacitacionDerechosHumanosPorc DECIMAL(5,2) NULL,
  PoliticaDerechosHumanos BIT NULL,
  FechaCarga DATETIME DEFAULT GETDATE(),
  FOREIGN KEY (EmpresaID) REFERENCES Empresas(EmpresaID)
);

CREATE TABLE IndicadoresGobernanza (
  Id INT IDENTITY PRIMARY KEY,
  EmpresaID INT NOT NULL,
  Periodo NVARCHAR(10) NOT NULL,
  CumplimientoNormativo DECIMAL(5,2) NULL,
  PoliticasAnticorrupcion BIT NULL,
  AuditadoPorTerceros BIT NULL,
  NivelTransparencia DECIMAL(5,2) NULL,
  PorcentajeDirectoresIndependientes DECIMAL(5,2) NULL,
  DiversidadDirectorioPorc DECIMAL(5,2) NULL,
  ComiteSostenibilidad BIT NULL,
  EvaluacionEticaAnual BIT NULL,
  ReunionesStakeholders INT NULL,
  CanalDenunciasActivo BIT NULL,
  PoliticaRemuneracionEsg BIT NULL,
  EvaluacionRiesgosEsgTrimestral BIT NULL,
  CapacitacionGobiernoEsgPorc DECIMAL(5,2) NULL,
  AuditoriasCompliance INT NULL,
  ReporteSostenibilidadVerificado BIT NULL,
  RelacionStakeholdersClave NVARCHAR(200) NULL,
  FechaCarga DATETIME DEFAULT GETDATE(),
  FOREIGN KEY (EmpresaID) REFERENCES Empresas(EmpresaID)
);

CREATE TABLE EvidenciasIndicadores (
  Id INT IDENTITY PRIMARY KEY,
  EmpresaID INT NOT NULL,
  Periodo NVARCHAR(10) NOT NULL,
  Tipo NVARCHAR(50) NOT NULL,
  Indicador NVARCHAR(100) NULL,
  NombreArchivo NVARCHAR(255) NOT NULL,
  Ruta NVARCHAR(500) NOT NULL,
  Proveedor NVARCHAR(50) NOT NULL,
  UrlPublica NVARCHAR(500) NULL,
  Metadata NVARCHAR(MAX) NULL,
  FechaCarga DATETIME DEFAULT GETDATE(),
  FOREIGN KEY (EmpresaID) REFERENCES Empresas(EmpresaID)
);

CREATE TABLE Usuarios (
  UsuarioID INT IDENTITY PRIMARY KEY,
  EmpresaID INT NULL,
  Nombre NVARCHAR(100),
  Email NVARCHAR(100) UNIQUE NOT NULL,
  PasswordHash NVARCHAR(255) NOT NULL,
  Rol NVARCHAR(50) DEFAULT 'manager',
  FechaRegistro DATETIME DEFAULT GETDATE(),
  FOREIGN KEY (EmpresaID) REFERENCES Empresas(EmpresaID)
);


CREATE TABLE IndicadoresPersonalizados (
  Id INT IDENTITY PRIMARY KEY,
  EmpresaID INT NOT NULL,
  PlantaID INT NOT NULL,
  Nombre NVARCHAR(120) NOT NULL,
  Categoria NVARCHAR(30) NOT NULL,
  Valor DECIMAL(5,2) NOT NULL,
  Periodo NVARCHAR(10) NULL,
  Unidad NVARCHAR(30) NULL,
  Descripcion NVARCHAR(255) NULL,
  FechaCreacion DATETIME DEFAULT GETDATE(),
  FOREIGN KEY (EmpresaID) REFERENCES Empresas(EmpresaID),
  FOREIGN KEY (PlantaID) REFERENCES Plantas(PlantaID)
);

CREATE TABLE EmpresaUbicaciones (
  Id INT IDENTITY PRIMARY KEY,
  EmpresaID INT UNIQUE NOT NULL,
  Latitud DECIMAL(9,6) NULL,
  Longitud DECIMAL(9,6) NULL,
  PuntajeEsg DECIMAL(5,2) NULL,
  Actualizado DATETIME DEFAULT GETDATE(),
  FOREIGN KEY (EmpresaID) REFERENCES Empresas(EmpresaID)
);

CREATE TABLE Plantas (
  PlantaID INT IDENTITY PRIMARY KEY,
  EmpresaID INT NOT NULL,
  Nombre NVARCHAR(120) NOT NULL,
  Ubicacion NVARCHAR(200) NULL,
  Descripcion NVARCHAR(255) NULL,
  FechaCreacion DATETIME DEFAULT GETDATE(),
  Latitud DECIMAL(10, 8) NULL,
  Longitud DECIMAL(11, 8) NULL,
  FOREIGN KEY (EmpresaID) REFERENCES Empresas(EmpresaID)
);

CREATE TABLE EvidenciasAI (
  Id INT IDENTITY PRIMARY KEY,
  EmpresaID INT NOT NULL,
  Periodo NVARCHAR(50) NULL,
  Categoria NVARCHAR(50) NOT NULL,
  Resumen NVARCHAR(MAX) NOT NULL,
  Indicadores NVARCHAR(MAX) NULL,
  NombreArchivo NVARCHAR(255) NOT NULL,
  TipoArchivo NVARCHAR(120) NULL,
  MimeType NVARCHAR(120) NULL,
  TextoExtraido NVARCHAR(MAX) NULL,
  Fuente NVARCHAR(100) NOT NULL DEFAULT 'ai-analysis',
  FechaAnalisis DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
  FOREIGN KEY (EmpresaID) REFERENCES Empresas(EmpresaID)
);

CREATE INDEX IX_EvidenciasAI_EmpresaPeriodo
ON EvidenciasAI (EmpresaID, Periodo);

CREATE TABLE DataIngestionRuns (
  Id INT IDENTITY PRIMARY KEY,
  EmpresaID INT NOT NULL,
  Periodo NVARCHAR(50) NULL,
  Fuente NVARCHAR(80) NOT NULL,
  Estado NVARCHAR(40) NOT NULL,
  Descripcion NVARCHAR(255) NULL,
  TotalFuentes INT DEFAULT 0,
  TotalArchivos INT DEFAULT 0,
  TotalIndicadores INT DEFAULT 0,
  Resumen NVARCHAR(500) NULL,
  Metadata NVARCHAR(MAX) NULL,
  FechaInicio DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
  FechaFin DATETIME2 NULL,
  FOREIGN KEY (EmpresaID) REFERENCES Empresas(EmpresaID)
);

CREATE TABLE DataIngestionItems (
  Id INT IDENTITY PRIMARY KEY,
  IngestionId INT NOT NULL,
  Pilar NVARCHAR(30) NOT NULL,
  Indicador NVARCHAR(120) NOT NULL,
  Valor DECIMAL(18,4) NULL,
  Unidad NVARCHAR(30) NULL,
  Fuente NVARCHAR(120) NULL,
  FechaDato DATETIME2 NULL,
  Metadata NVARCHAR(MAX) NULL,
  FOREIGN KEY (IngestionId) REFERENCES DataIngestionRuns(Id)
);

CREATE TABLE DataIngestionAlerts (
  Id INT IDENTITY PRIMARY KEY,
  IngestionId INT NOT NULL,
  Tipo NVARCHAR(60) NOT NULL,
  Indicador NVARCHAR(120) NULL,
  Mensaje NVARCHAR(500) NOT NULL,
  Nivel NVARCHAR(30) NOT NULL DEFAULT 'warning',
  Metadata NVARCHAR(MAX) NULL,
  Resuelto BIT NOT NULL DEFAULT 0,
  Fecha DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
  FechaResolucion DATETIME2 NULL,
  FOREIGN KEY (IngestionId) REFERENCES DataIngestionRuns(Id)
);

CREATE INDEX IX_DataIngestionRuns_EmpresaPeriodo
ON DataIngestionRuns (EmpresaID, Periodo DESC);

CREATE INDEX IX_DataIngestionAlerts_Ingestion
ON DataIngestionAlerts (IngestionId, Resuelto);

CREATE TABLE EsgAuditRuns (
  Id INT IDENTITY PRIMARY KEY,
  EmpresaID INT NOT NULL,
  Periodo NVARCHAR(50) NULL,
  Estado NVARCHAR(30) NOT NULL DEFAULT 'processing',
  EjecutadoPor NVARCHAR(120) NULL,
  Resumen NVARCHAR(500) NULL,
  TotalIndicadores INT DEFAULT 0,
  TotalHallazgos INT DEFAULT 0,
  HallazgosCriticos INT DEFAULT 0,
  HallazgosAdvertencias INT DEFAULT 0,
  HallazgosInformativos INT DEFAULT 0,
  Metadata NVARCHAR(MAX) NULL,
  FechaInicio DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
  FechaFin DATETIME2 NULL,
  FOREIGN KEY (EmpresaID) REFERENCES Empresas(EmpresaID)
);

CREATE TABLE EsgAuditFindings (
  Id INT IDENTITY PRIMARY KEY,
  RunId INT NOT NULL,
  Pilar NVARCHAR(30) NOT NULL,
  Indicador NVARCHAR(120) NOT NULL,
  Severidad NVARCHAR(20) NOT NULL,
  Categoria NVARCHAR(60) NULL,
  Mensaje NVARCHAR(500) NOT NULL,
  Sugerencia NVARCHAR(500) NULL,
  Periodo NVARCHAR(50) NULL,
  PeriodoComparado NVARCHAR(50) NULL,
  ValorActual DECIMAL(18,4) NULL,
  ValorAnterior DECIMAL(18,4) NULL,
  ValorEsperado DECIMAL(18,4) NULL,
  Delta DECIMAL(18,4) NULL,
  DeltaPorcentaje DECIMAL(18,4) NULL,
  Metadata NVARCHAR(MAX) NULL,
  Fecha DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
  FOREIGN KEY (RunId) REFERENCES EsgAuditRuns(Id)
);

CREATE INDEX IX_EsgAuditRuns_EmpresaPeriodo
ON EsgAuditRuns (EmpresaID, Periodo DESC, FechaInicio DESC);

CREATE INDEX IX_EsgAuditFindings_Run
ON EsgAuditFindings (RunId, Severidad);

CREATE TABLE CarbonEmissionFactors (
  Id INT IDENTITY PRIMARY KEY,
  Pais NVARCHAR(120) NOT NULL,
  CodigoPais NVARCHAR(8) NULL,
  Alcance NVARCHAR(20) NOT NULL,
  Categoria NVARCHAR(80) NOT NULL,
  Anio INT NOT NULL,
  Factor DECIMAL(18,8) NOT NULL,
  UnidadActividad NVARCHAR(30) NOT NULL,
  UnidadResultado NVARCHAR(30) NOT NULL DEFAULT 'tCO2e',
  Fuente NVARCHAR(255) NULL,
  UltimaActualizacion DATETIME2 NOT NULL DEFAULT SYSDATETIME()
);

CREATE UNIQUE INDEX UX_CarbonEmissionFactors_Key
ON CarbonEmissionFactors (ISNULL(CodigoPais, ''), Alcance, Categoria, Anio);

CREATE TABLE CarbonFootprintSnapshots (
  Id INT IDENTITY PRIMARY KEY,
  EmpresaID INT NOT NULL,
  Periodo NVARCHAR(50) NOT NULL,
  Alcance1 DECIMAL(18,4) NOT NULL DEFAULT 0,
  Alcance2 DECIMAL(18,4) NOT NULL DEFAULT 0,
  Alcance3 DECIMAL(18,4) NOT NULL DEFAULT 0,
  Total DECIMAL(18,4) NOT NULL DEFAULT 0,
  FactoresUtilizados NVARCHAR(MAX) NULL,
  Metadatos NVARCHAR(MAX) NULL,
  FechaCalculo DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
  FOREIGN KEY (EmpresaID) REFERENCES Empresas(EmpresaID)
);

CREATE UNIQUE INDEX UX_CarbonFootprintSnapshots_EmpresaPeriodo
ON CarbonFootprintSnapshots (EmpresaID, Periodo);

CREATE TABLE CarbonFootprintBreakdown (
  Id INT IDENTITY PRIMARY KEY,
  SnapshotId INT NOT NULL,
  Alcance NVARCHAR(20) NOT NULL,
  Categoria NVARCHAR(80) NOT NULL,
  Actividad DECIMAL(18,6) NULL,
  Unidad NVARCHAR(20) NULL,
  Factor DECIMAL(18,8) NULL,
  Resultado DECIMAL(18,4) NOT NULL,
  FuenteDato NVARCHAR(40) NULL,
  Notas NVARCHAR(255) NULL,
  FOREIGN KEY (SnapshotId) REFERENCES CarbonFootprintSnapshots(Id)
);

CREATE INDEX IX_CarbonFootprintBreakdown_Snapshot
ON CarbonFootprintBreakdown (SnapshotId, Alcance, Categoria);

CREATE TABLE CarbonReductionScenarios (
  Id INT IDENTITY PRIMARY KEY,
  SnapshotId INT NOT NULL,
  Nombre NVARCHAR(120) NOT NULL,
  Descripcion NVARCHAR(255) NULL,
  Alcance NVARCHAR(20) NOT NULL,
  Categoria NVARCHAR(80) NOT NULL,
  ReduccionPorc DECIMAL(10,4) NULL,
  ResultadoProyectado DECIMAL(18,4) NULL,
  Delta DECIMAL(18,4) NULL,
  FOREIGN KEY (SnapshotId) REFERENCES CarbonFootprintSnapshots(Id)
);

CREATE INDEX IX_CarbonReductionScenarios_Snapshot
ON CarbonReductionScenarios (SnapshotId, Alcance);

-- Alertas predictivas de ESG
CREATE TABLE ESG_Alerts (
  Id INT IDENTITY PRIMARY KEY,
  CompanyId INT NOT NULL,
  PlantId INT NULL,
  IndicatorKey NVARCHAR(150) NOT NULL,
  CurrentValue DECIMAL(18,4) NULL,
  PredictedValue DECIMAL(18,4) NULL,
  RiskLevel NVARCHAR(10) NOT NULL,
  Message NVARCHAR(500) NOT NULL,
  CreatedAt DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
  FOREIGN KEY (CompanyId) REFERENCES Empresas(EmpresaID),
  FOREIGN KEY (PlantId) REFERENCES Plantas(PlantaID)
);

CREATE INDEX IX_ESG_Alerts_CompanyPlant
ON ESG_Alerts (CompanyId, ISNULL(PlantId, 0), RiskLevel);

-- Pronósticos regulatorios
CREATE TABLE RegulatoryForecasts (
  Id INT IDENTITY PRIMARY KEY,
  CompanyId INT NOT NULL,
  Category NVARCHAR(5) NOT NULL,
  Region NVARCHAR(120) NOT NULL,
  ForecastText NVARCHAR(MAX) NOT NULL,
  Probability DECIMAL(5,4) NOT NULL,
  ImpactLevel NVARCHAR(10) NOT NULL,
  DateCreated DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
  FOREIGN KEY (CompanyId) REFERENCES Empresas(EmpresaID)
);

CREATE INDEX IX_RegulatoryForecasts_Company ON RegulatoryForecasts (CompanyId, Category, DateCreated DESC);

-- Auditoría automática de indicadores vs evidencias
CREATE TABLE AuditLogs (
  Id INT IDENTITY PRIMARY KEY,
  CompanyId INT NOT NULL,
  PlantId INT NULL,
  IndicatorId INT NULL,
  IndicatorKey NVARCHAR(150) NULL,
  Status NVARCHAR(20) NOT NULL,
  Message NVARCHAR(MAX) NULL,
  Confidence INT NULL,
  CreatedAt DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
  FOREIGN KEY (CompanyId) REFERENCES Empresas(EmpresaID),
  FOREIGN KEY (PlantId) REFERENCES Plantas(PlantaID)
);

CREATE INDEX IX_AuditLogs_CompanyPlant ON AuditLogs (CompanyId, ISNULL(PlantId, 0), CreatedAt DESC);
