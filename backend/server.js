import express from 'express';
import cors from 'cors';
import sql from 'mssql';
import fs from 'fs';
import path from 'path';
import http from 'http';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

const envFiles = ['.env.local', '.env'];
for (const envFile of envFiles) {
  const envPath = path.join(projectRoot, envFile);
  if (fs.existsSync(envPath)) {
    dotenv.config({ path: envPath, override: false });
  }
}

const app = express();
const port = Number(process.env.API_PORT || 3000);
const serveStatic = String(process.env.SERVE_STATIC || 'false').toLowerCase() === 'true';
const distPath = path.join(projectRoot, 'dist');

const allowedOrigins = String(process.env.CORS_ORIGIN || '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

const allowAllOrigins = allowedOrigins.includes('*');

const corsOptions = allowedOrigins.length > 0 && !allowAllOrigins
  ? {
      origin: (origin, callback) => {
        if (!origin || allowedOrigins.includes(origin)) {
          callback(null, true);
          return;
        }

        callback(new Error('Origen no permitido por CORS.'));
      }
    }
  : {};

app.use(cors(corsOptions));
app.use(express.json());

const dbConfig = {
  server: process.env.DB_SERVER || '192.168.40.20',
  database: process.env.DB_NAME || 'ICGFRONT',
  user: process.env.DB_USER || 'ICGAdmin',
  password: process.env.DB_PASSWORD || 'masteRkey',
  options: {
    encrypt: process.env.DB_ENCRYPT === 'true',
    trustServerCertificate: true
  }
};

let poolPromise;

const getPool = async () => {
  if (!dbConfig.user || !dbConfig.password) {
    throw new Error('Faltan DB_USER y DB_PASSWORD en variables de entorno.');
  }

  if (!poolPromise) {
    poolPromise = new sql.ConnectionPool(dbConfig)
      .connect()
      .then((pool) => pool)
      .catch((error) => {
        poolPromise = null;
        throw error;
      });
  }

  return poolPromise;
};

const taxIdPattern = /^[A-Za-z0-9]{3,20}$/;
const passwordPattern = /^\d{7}$/;
const maxPasswordAttempts = 5;
const failedPasswordAttemptsByTaxId = new Map();
const passwordOverrideByTaxId = new Map();
const privacyConsentByTaxId = new Map();
const docsAuthorizedRoot = process.env.DOCS_AUTHORIZED_PATH || '\\\\192.168.1.164\\DocumentosElectronicos\\Autorizados';
const docsAuthorizedFallbackRoot = '\\\\192.168.1.164\\DocumentosElectronicos\\Autorizados';
const docsAuthorizedLegacyRoot = 'C:\\ICG\\APPS\\DocumentosElectronicos\\Autorizados';

const getAuthorizedRootCandidates = () => {
  const candidates = [docsAuthorizedRoot, docsAuthorizedFallbackRoot, docsAuthorizedLegacyRoot]
    .map((candidate) => path.resolve(String(candidate || '').trim()))
    .filter(Boolean);

  const unique = [];
  const used = new Set();
  for (const candidate of candidates) {
    const key = candidate.toLowerCase();
    if (!used.has(key)) {
      used.add(key);
      unique.push(candidate);
    }
  }

  return unique;
};

const toLowerSet = (columns) => new Set(columns.map((column) => column.toLowerCase()));

const pickColumn = (columnSet, candidates) => {
  for (const candidate of candidates) {
    if (columnSet.has(candidate.toLowerCase())) {
      return candidate;
    }
  }
  return null;
};

const parseBooleanDbValue = (value) => {
  if (value === null || value === undefined) return false;

  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value === 1;

  const normalized = String(value).trim().toUpperCase();
  return ['1', 'S', 'SI', 'TRUE', 'Y', 'YES'].includes(normalized);
};

const resolveFidelizadoColumn = (clientesColumns = []) => {
  const clientesSet = toLowerSet(clientesColumns);
  return pickColumn(clientesSet, ['FIDELIZADO', 'ESFIDELIZADO', 'CLIENTEFIDELIZADO', 'FIDELIZA']);
};

const quoteIdentifier = (identifier) => `[${String(identifier).replace(/]/g, ']]')}]`;

const buildTableReference = (schemaName, tableName) => {
  if (schemaName) {
    return `${quoteIdentifier(schemaName)}.${quoteIdentifier(tableName)}`;
  }
  return quoteIdentifier(tableName);
};

const resolveTableMetadata = async (pool, tableName, required = false) => {
  const schemaCandidates = [
    process.env.DB_SCHEMA,
    'dbo',
    null
  ].filter((value, index, self) => value !== undefined && self.indexOf(value) === index);

  const attempts = [];

  for (const schemaName of schemaCandidates) {
    const tableRef = buildTableReference(schemaName, tableName);
    attempts.push(tableRef);

    try {
      const result = await pool.request().query(`SELECT TOP (0) * FROM ${tableRef}`);
      const columns = Object.keys(result.recordset?.columns || {});
      return { tableRef, columns };
    } catch {
      // intenta el siguiente esquema candidato
    }
  }

  if (required) {
    throw new Error(`No se pudo acceder a la tabla ${tableName}. Intentos: ${attempts.join(', ')}`);
  }

  return { tableRef: null, columns: [] };
};

const resolveFirstTableMetadata = async (pool, tableNames, required = false) => {
  const errors = [];

  for (const tableName of tableNames) {
    try {
      const metadata = await resolveTableMetadata(pool, tableName, false);
      if (metadata.tableRef) {
        return { ...metadata, tableName };
      }
    } catch (error) {
      errors.push(`${tableName}: ${error.message}`);
    }
  }

  if (required) {
    throw new Error(`No se pudo resolver ninguna tabla entre: ${tableNames.join(', ')}${errors.length ? `. Detalle: ${errors.join(' | ')}` : ''}`);
  }

  return { tableRef: null, columns: [], tableName: null };
};

const resolveClientesIdentityContext = async (pool, required = true) => {
  const clientesMeta = await resolveFirstTableMetadata(pool, ['CLIENTES'], required);
  const clientesSet = toLowerSet(clientesMeta.columns);
  const idColumn = pickColumn(clientesSet, ['NIF20', 'CIF', 'CEDULA', 'RUC', 'IDENTIFICACION']);

  if (!idColumn && required) {
    throw new Error('CLIENTES no tiene columna de identificación (NIF20/CIF/CEDULA/RUC/IDENTIFICACION).');
  }

  return {
    clientesTableRef: clientesMeta.tableRef,
    clientesIdColumn: idColumn,
    clientesColumns: clientesMeta.columns
  };
};

const normalizeTaxIdValue = (value) => String(value || '').replace(/[^a-zA-Z0-9]/g, '').toUpperCase();

const buildNormalizedTaxIdSql = (sqlExpression) => `UPPER(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(LTRIM(RTRIM(COALESCE(CAST(${sqlExpression} AS varchar(40)), ''))), ' ', ''), '-', ''), '.', ''), '/', ''), '_', ''))`;

const buildClientesTaxIdSql = (alias, clientesIdColumn, clientesColumns = []) => {
  const hasCif = toLowerSet(clientesColumns).has('cif');
  if (String(clientesIdColumn || '').toUpperCase() === 'NIF20' && hasCif) {
    return `COALESCE(NULLIF(${alias}.${quoteIdentifier('NIF20')}, ''), ${alias}.${quoteIdentifier('CIF')})`;
  }

  return `${alias}.${quoteIdentifier(clientesIdColumn || 'CIF')}`;
};

const normalizeStatus = (value) => {
  const status = String(value || '').toUpperCase();
  if (status.includes('PAG')) return 'PAGADA';
  if (status.includes('ANUL') || status.includes('CANCEL')) return 'CANCELADA';
  return 'PENDIENTE';
};

const formatDate = (value) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleDateString('es-EC');
};

const formatTime = (value) => {
  if (!value) return '';
  if (typeof value === 'string') return value;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleTimeString('es-EC', { hour12: false });
};

const toNumber = (value) => {
  if (value === null || value === undefined || value === '') return 0;
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
};

const normalizeSearchToken = (value) => String(value || '').replace(/[^a-zA-Z0-9]/g, '').toLowerCase();

const extractSerieFactura = (invoice) => {
  const explicitSerie = String(invoice?.numSerie || '').trim();
  const explicitFactura = String(invoice?.numFactura || '').trim();
  if (explicitSerie && explicitFactura) {
    return { serie: explicitSerie, factura: explicitFactura };
  }

  const candidates = [invoice?.folio, invoice?.id, invoice?.systemNumber]
    .map((value) => String(value || '').trim())
    .filter(Boolean);

  for (const candidate of candidates) {
    const parts = candidate.split(/[-_/\\.]/).map((part) => part.trim()).filter(Boolean);
    if (parts.length >= 2) {
      const maybeSerie = parts[0];
      const maybeFactura = parts[1];
      if (/^[a-zA-Z]+$/.test(maybeSerie) && /^\d+$/.test(maybeFactura)) {
        return { serie: maybeSerie, factura: maybeFactura };
      }
    }
  }

  return { serie: '', factura: '' };
};

const getSerieFacturaTokens = (invoice) => {
  const { serie: numSerie, factura: numFactura } = extractSerieFactura(invoice);
  if (!numSerie || !numFactura) {
    return [];
  }

  const serie = normalizeSearchToken(numSerie);
  const factura = normalizeSearchToken(numFactura);
  if (!serie || !factura) {
    return [];
  }

  const paddedFactura9 = numFactura.padStart(9, '0');
  const paddedFactura8 = numFactura.padStart(8, '0');

  const baseTokens = [
    `${serie}${factura}`,
    `${serie}_${factura}`,
    `${serie}-${factura}`,
    `${serie}.${factura}`,
    `${factura}${serie}`,
    `${serie}${paddedFactura9}`,
    `${serie}_${paddedFactura9}`,
    `${serie}-${paddedFactura9}`,
    `${serie}${paddedFactura8}`,
    `${serie}_${paddedFactura8}`,
    `${serie}-${paddedFactura8}`
  ];

  const firmaPrefixes = [
    invoice?.firmaToken,
    invoice?.accessKey,
    invoice?.authorizationNumber
  ].map((value) => String(value || '').trim()).filter(Boolean);

  const compositeTokens = [];
  for (const prefix of firmaPrefixes) {
    compositeTokens.push(`${prefix}_${numSerie}_${paddedFactura9}`);
    compositeTokens.push(`${prefix}_${numSerie}_${paddedFactura8}`);
    compositeTokens.push(`${prefix}_${numSerie}_${numFactura}`);
  }

  return [...baseTokens, ...compositeTokens].map((value) => normalizeSearchToken(value));
};

const getInvoiceSearchTokens = (invoice) => {
  const rawTokens = [
    ...getSerieFacturaTokens(invoice),
    invoice?.accessKey,
    invoice?.authorizationNumber,
    invoice?.folio,
    invoice?.id,
    invoice?.systemNumber
  ];

  const tokenSet = new Set();
  for (const rawToken of rawTokens) {
    const normalized = normalizeSearchToken(rawToken);
    if (normalized.length >= 3) {
      tokenSet.add(normalized);
    }
  }

  return Array.from(tokenSet);
};

const buildDirectCandidatePaths = (rootPath, format, tokens, invoice) => {
  const extension = `.${format}`;
  const candidatePaths = [];

  for (const token of tokens) {
    candidatePaths.push(path.join(rootPath, `${token}${extension}`));
    candidatePaths.push(path.join(rootPath, `FACTURA_${token}${extension}`));
    candidatePaths.push(path.join(rootPath, `RIDE_${token}${extension}`));
    candidatePaths.push(path.join(rootPath, `AUTORIZADO_${token}${extension}`));
  }

  const { serie, factura } = extractSerieFactura(invoice);
  if (serie && factura) {
    const paddedFactura9 = factura.padStart(9, '0');
    const paddedFactura8 = factura.padStart(8, '0');
    const prefixes = [
      String(invoice?.firmaToken || '').trim(),
      String(invoice?.accessKey || '').trim(),
      String(invoice?.authorizationNumber || '').trim()
    ].filter(Boolean);

    for (const prefix of prefixes) {
      candidatePaths.push(path.join(rootPath, `${prefix}_${serie}_${paddedFactura9}${extension}`));
      candidatePaths.push(path.join(rootPath, `${prefix}_${serie}_${paddedFactura8}${extension}`));
      candidatePaths.push(path.join(rootPath, `${prefix}_${serie}_${factura}${extension}`));
    }

    candidatePaths.push(path.join(rootPath, `${serie}_${paddedFactura9}${extension}`));
    candidatePaths.push(path.join(rootPath, `${serie}_${paddedFactura8}${extension}`));
    candidatePaths.push(path.join(rootPath, `${serie}_${factura}${extension}`));
  }

  return candidatePaths;
};

const findDocumentInAuthorizedFolder = async (invoice, format) => {
  const rootPaths = getAuthorizedRootCandidates().filter((rootPath) => fs.existsSync(rootPath));
  if (rootPaths.length === 0) return null;

  const tokens = getInvoiceSearchTokens(invoice);
  if (tokens.length === 0) {
    return null;
  }

  for (const rootPath of rootPaths) {
    const directCandidatePaths = buildDirectCandidatePaths(rootPath, format, tokens, invoice);
    for (const candidatePath of directCandidatePaths) {
      if (fs.existsSync(candidatePath)) {
        return candidatePath;
      }
    }
  }

  const expectedExtension = `.${format}`;
  const pendingDirectories = [...rootPaths];

  while (pendingDirectories.length > 0) {
    const currentDir = pendingDirectories.pop();
    let entries = [];

    try {
      entries = await fs.promises.readdir(currentDir, { withFileTypes: true });
    } catch {
      continue;
    }

    for (const entry of entries) {
      const entryPath = path.join(currentDir, entry.name);

      let entryIsDirectory = entry.isDirectory();
      let entryIsFile = entry.isFile();

      if (!entryIsDirectory && !entryIsFile) {
        try {
          const stats = await fs.promises.stat(entryPath);
          entryIsDirectory = stats.isDirectory();
          entryIsFile = stats.isFile();
        } catch {
          continue;
        }
      }

      if (entryIsDirectory) {
        pendingDirectories.push(entryPath);
        continue;
      }

      if (!entryIsFile) {
        continue;
      }

      if (path.extname(entry.name).toLowerCase() !== expectedExtension) {
        continue;
      }

      const normalizedName = normalizeSearchToken(path.basename(entry.name, expectedExtension));
      if (!normalizedName) {
        continue;
      }

      const matched = tokens.some((token) => normalizedName.includes(token));
      if (matched) {
        return entryPath;
      }
    }
  }

  return null;
};

const getInvoicesContext = async (pool) => {
  const ventasMeta = await resolveFirstTableMetadata(pool, ['FACTURASVENTAS', 'FACTURASVENTA'], true);
  const firmaMeta = await resolveFirstTableMetadata(pool, ['FACTURASVENTASFIRMA', 'FACTURASVENTAFIRMA'], false);
  const clientesIdentity = await resolveClientesIdentityContext(pool, false);
  const clientesMeta = {
    tableRef: clientesIdentity.clientesTableRef,
    columns: clientesIdentity.clientesColumns
  };
  const facturaClientesMeta = await resolveFirstTableMetadata(pool, ['FACTURASVENTACLIENTES'], false);

  const ventasColumns = ventasMeta.columns;
  const firmaColumns = firmaMeta.columns;
  const clientesColumns = clientesMeta.columns;
  const facturaClientesColumns = facturaClientesMeta.columns;

  if (ventasColumns.length === 0) {
    throw new Error('No se encontraron columnas en FACTURASVENTAS.');
  }

  const ventasSet = toLowerSet(ventasColumns);
  const firmaSet = toLowerSet(firmaColumns);
  const clientesSet = toLowerSet(clientesColumns);
  const facturaClientesSet = toLowerSet(facturaClientesColumns);

  const isIcgFacturasVentaModel =
    ventasSet.has('codcliente') &&
    ventasSet.has('numserie') &&
    ventasSet.has('numfactura') &&
    clientesMeta.tableRef &&
    clientesSet.has('codcliente') &&
    Boolean(clientesIdentity.clientesIdColumn);

  const customerIdColumn = pickColumn(ventasSet, ['NIF20', 'CIF', 'CEDULA', 'RUC', 'IDENTIFICACION']);
  if (!customerIdColumn && !isIcgFacturasVentaModel) {
    throw new Error('FACTURASVENTAS no tiene una columna de identificación del cliente (NIF20/CIF/CEDULA/RUC/IDENTIFICACION).');
  }

  const joinCandidates = [
    ['IDFACTURAVENTA', 'IDFACTURAVENTA'],
    ['IDFACTURA', 'IDFACTURA'],
    ['FACTURAID', 'FACTURAID'],
    ['NUMEROFACTURA', 'NUMEROFACTURA'],
    ['NFACTURA', 'NFACTURA'],
    ['CLAVEACCESO', 'CLAVEACCESO'],
    ['NUMEROAUTORIZACION', 'NUMEROAUTORIZACION']
  ];

  let joinPair = null;
  for (const [ventasColumn, firmaColumn] of joinCandidates) {
    if (ventasSet.has(ventasColumn.toLowerCase()) && firmaSet.has(firmaColumn.toLowerCase())) {
      joinPair = { ventasColumn, firmaColumn };
      break;
    }
  }

  const idColumn = pickColumn(ventasSet, ['IDFACTURAVENTA', 'IDFACTURA', 'ID', 'CLAVEACCESO', 'NFACTURA', 'NUMEROFACTURA']);
  const folioColumn = pickColumn(ventasSet, ['NUMEROFACTURA', 'NFACTURA', 'FACTURA', 'SECUENCIAL']);
  const systemNumberColumn = pickColumn(ventasSet, ['LADF', 'NUMEROSISTEMA', 'SISTEMA', 'IDFACTURA', 'IDFACTURAVENTA']);
  const numSerieColumn = pickColumn(ventasSet, ['NUMSERIE', 'SERIE']);
  const numFacturaColumn = pickColumn(ventasSet, ['NUMFACTURA', 'NUMEROFACTURA', 'NFACTURA']);
  const accessKeyVentasColumn = pickColumn(ventasSet, ['CLAVEACCESO', 'CLAVE']);
  const accessKeyFirmaColumn = pickColumn(firmaSet, ['CLAVEACCESO', 'CLAVE']);
  const dateColumn = pickColumn(ventasSet, ['FECHAEMISION', 'FECHA', 'FEMISION']);
  const timeColumn = pickColumn(ventasSet, ['HORAEMISION', 'HORA']);
  const vendorColumn = pickColumn(ventasSet, ['VENDEDOR', 'NOMBREVENDEDOR', 'USUARIO']);
  const clientNameColumn = pickColumn(ventasSet, ['CLIENTE', 'NOMBRECLIENTE', 'RAZONSOCIALCLIENTE']);
  const totalColumn = pickColumn(ventasSet, ['TOTAL', 'TOTALFACTURA', 'IMPORTETOTAL', 'VALORTOTAL']);
  const taxColumn = pickColumn(ventasSet, ['IVA', 'VALORIVA', 'IMPUESTO']);
  const currencyColumn = pickColumn(ventasSet, ['MONEDA']);
  const statusColumn = pickColumn(ventasSet, ['ESTADO', 'STATUS']);

  const authorizationColumn = pickColumn(firmaSet, ['NUMEROAUTORIZACION', 'AUTORIZACION', 'NUM_AUTORIZACION']);
  const authorizationDateColumn = pickColumn(firmaSet, ['FECHAAUTORIZACION', 'FECHA_AUTORIZACION']);
  const environmentColumn = pickColumn(firmaSet, ['AMBIENTE']);
  const emissionTypeColumn = pickColumn(firmaSet, ['TIPOEMISION', 'TIPO_EMISION']);
  const firmaTokenColumn = pickColumn(firmaSet, ['FIRMA']);

  const pdfUrlColumn = pickColumn(firmaSet, ['URLPDF', 'PDF_URL', 'RUTA_PDF', 'RUTAPDF', 'ARCHIVOPDF']);
  const pdfContentColumn = pickColumn(firmaSet, ['PDF', 'PDFBASE64', 'CONTENIDOPDF']);
  const xmlUrlColumn = pickColumn(firmaSet, ['URLXML', 'XML_URL', 'RUTA_XML', 'RUTAXML', 'ARCHIVOXML']);
  const xmlContentColumn = pickColumn(firmaSet, ['XML', 'XMLFIRMADO', 'XMLBASE64', 'CONTENIDOXML']);

  return {
    isIcgFacturasVentaModel,
    ventasTableRef: ventasMeta.tableRef,
    firmaTableRef: firmaMeta.tableRef,
    clientesTableRef: clientesMeta.tableRef,
    facturaClientesTableRef: facturaClientesMeta.tableRef,
    customerIdColumn,
    clientesIdColumn: clientesIdentity.clientesIdColumn,
    clientesColumns,
    joinPair,
    idColumn,
    folioColumn,
    systemNumberColumn,
    numSerieColumn,
    numFacturaColumn,
    accessKeyVentasColumn,
    accessKeyFirmaColumn,
    dateColumn,
    timeColumn,
    vendorColumn,
    clientNameColumn,
    totalColumn,
    taxColumn,
    currencyColumn,
    statusColumn,
    authorizationColumn,
    authorizationDateColumn,
    environmentColumn,
    emissionTypeColumn,
    firmaTokenColumn,
    pdfUrlColumn,
    pdfContentColumn,
    xmlUrlColumn,
    xmlContentColumn
  };
};

const fetchInvoicesByTaxId = async (pool, taxId) => {
  const ctx = await getInvoicesContext(pool);
  const normalizedTaxId = normalizeTaxIdValue(taxId);

  if (ctx.isIcgFacturasVentaModel) {
    const clientesTaxIdSql = buildClientesTaxIdSql('c', ctx.clientesIdColumn, ctx.clientesColumns || []);

    const query = `
      SELECT TOP (500)
        CONCAT(
          CAST(fv.[NUMSERIE] AS varchar(30)) COLLATE DATABASE_DEFAULT,
          '-' COLLATE DATABASE_DEFAULT,
          CAST(fv.[NUMFACTURA] AS varchar(30)) COLLATE DATABASE_DEFAULT,
          '-' COLLATE DATABASE_DEFAULT,
          CAST(fv.[N] AS varchar(30)) COLLATE DATABASE_DEFAULT
        ) AS [invoiceId],
        CONCAT(
          CAST(fv.[NUMSERIE] AS varchar(30)) COLLATE DATABASE_DEFAULT,
          '-' COLLATE DATABASE_DEFAULT,
          CAST(fv.[NUMFACTURA] AS varchar(30)) COLLATE DATABASE_DEFAULT
        ) AS [folio],
        COALESCE(
          CAST(fs.[SERIE] AS varchar(30)) COLLATE DATABASE_DEFAULT,
          CAST(fv.[NUMSERIE] AS varchar(30)) COLLATE DATABASE_DEFAULT,
          '' COLLATE DATABASE_DEFAULT
        ) AS [systemNumber],
        CAST(fv.[NUMSERIE] AS varchar(30)) COLLATE DATABASE_DEFAULT AS [numSerie],
        CAST(fv.[NUMFACTURA] AS varchar(30)) COLLATE DATABASE_DEFAULT AS [numFactura],
        COALESCE(CAST(fs.[CLAVEACCESO] AS varchar(200)) COLLATE DATABASE_DEFAULT, '' COLLATE DATABASE_DEFAULT) AS [accessKey],
        fv.[FECHA] AS [invoiceDate],
        fv.[HORA] AS [invoiceTime],
        CAST(fv.[CODVENDEDOR] AS varchar(60)) AS [vendor],
        COALESCE(
          CAST(fvc.[NOMBRE] AS varchar(250)) COLLATE DATABASE_DEFAULT,
          CAST(c.[NOMBRECLIENTE] AS varchar(250)) COLLATE DATABASE_DEFAULT,
          '' COLLATE DATABASE_DEFAULT
        ) AS [clientName],
        CAST(${clientesTaxIdSql} AS varchar(30)) AS [clientTaxId],
        fv.[TOTALNETO] AS [total],
        fv.[TOTALIMPUESTOS] AS [tax],
        'USD' COLLATE DATABASE_DEFAULT AS [currency],
        'PAGADA' COLLATE DATABASE_DEFAULT AS [status],
        COALESCE(
          CAST(fs.[ATCUD] AS varchar(120)) COLLATE DATABASE_DEFAULT,
          CAST(fs.[CLAVEACCESO] AS varchar(200)) COLLATE DATABASE_DEFAULT,
          '' COLLATE DATABASE_DEFAULT
        ) AS [authorizationNumber],
        NULL AS [authorizationDate],
        COALESCE(CAST(fs.[CODIGOPROGRAMA] AS varchar(60)) COLLATE DATABASE_DEFAULT, '' COLLATE DATABASE_DEFAULT) AS [environment],
        COALESCE(CAST(fs.[VERSIONFIRMA] AS varchar(60)) COLLATE DATABASE_DEFAULT, '' COLLATE DATABASE_DEFAULT) AS [emissionType],
        COALESCE(CAST(fs.[FIRMA] AS varchar(255)) COLLATE DATABASE_DEFAULT, '' COLLATE DATABASE_DEFAULT) AS [firmaToken],
        NULL AS [pdfSource],
        NULL AS [xmlSource],
        NULL AS [pdfContent],
        CAST(fs.[FIRMA] AS varchar(max)) AS [xmlContent]
      FROM ${ctx.ventasTableRef} fv
      INNER JOIN ${ctx.clientesTableRef} c
        ON fv.[CODCLIENTE] = c.[CODCLIENTE]
      LEFT JOIN ${ctx.firmaTableRef || '[dbo].[FACTURASVENTAFIRMA]'} fs
        ON fv.[NUMSERIE] = fs.[SERIE]
       AND fv.[NUMFACTURA] = fs.[NUMERO]
       AND fv.[N] = fs.[N]
      LEFT JOIN ${ctx.facturaClientesTableRef || '[dbo].[FACTURASVENTACLIENTES]'} fvc
        ON fv.[NUMSERIE] = fvc.[NUMSERIE]
       AND fv.[NUMFACTURA] = fvc.[NUMFACTURA]
       AND fv.[N] = fvc.[N]
      WHERE ${buildNormalizedTaxIdSql(clientesTaxIdSql)} = @taxIdNormalized
      ORDER BY fv.[FECHA] DESC, fv.[NUMFACTURA] DESC
    `;

    const result = await pool
      .request()
      .input('taxIdNormalized', sql.VarChar(40), normalizedTaxId)
      .query(query);

    return result.recordset.map((row) => {
      const invoiceId = String(row.invoiceId || '').trim();
      const accessKey = String(row.accessKey || '').trim();
      const folio = String(row.folio || '').trim();
      const fallbackId = accessKey || folio || `inv-${Math.random().toString(36).slice(2, 10)}`;
      const normalizedId = invoiceId || fallbackId;

      return {
        id: normalizedId,
        folio: folio || normalizedId,
        systemNumber: String(row.systemNumber || normalizedId),
        numSerie: String(row.numSerie || ''),
        numFactura: String(row.numFactura || ''),
        accessKey,
        date: formatDate(row.invoiceDate),
        time: formatTime(row.invoiceTime),
        vendor: String(row.vendor || ''),
        clientName: String(row.clientName || ''),
        clientTaxId: String(row.clientTaxId || ''),
        supplier: 'COMERCIALIZADORA ONI S.A.',
        total: toNumber(row.total),
        tax: toNumber(row.tax),
        currency: String(row.currency || 'USD'),
        status: normalizeStatus(row.status),
        authorizationNumber: String(row.authorizationNumber || ''),
        authorizationDate: formatDate(row.authorizationDate),
        environment: String(row.environment || ''),
        emissionType: String(row.emissionType || ''),
        firmaToken: String(row.firmaToken || ''),
        pdfUrl: `/api/invoices/${encodeURIComponent(normalizedId)}/download/pdf?taxId=${encodeURIComponent(String(taxId))}`,
        xmlUrl: `/api/invoices/${encodeURIComponent(normalizedId)}/download/xml?taxId=${encodeURIComponent(String(taxId))}`,
        pdfSource: row.pdfSource,
        xmlSource: row.xmlSource,
        pdfContent: row.pdfContent,
        xmlContent: row.xmlContent,
        items: []
      };
    });
  }

  const sourceAlias = 'fv';
  const firmaAlias = 'fs';

  const selectParts = [];
  const append = (sqlExpression, alias) => {
    selectParts.push(`${sqlExpression} AS ${quoteIdentifier(alias)}`);
  };

  append(ctx.idColumn ? `${sourceAlias}.${quoteIdentifier(ctx.idColumn)}` : `CONVERT(varchar(64), NEWID())`, 'invoiceId');
  append(ctx.folioColumn ? `${sourceAlias}.${quoteIdentifier(ctx.folioColumn)}` : "''", 'folio');
  append(ctx.systemNumberColumn ? `${sourceAlias}.${quoteIdentifier(ctx.systemNumberColumn)}` : "''", 'systemNumber');
  append(ctx.numSerieColumn ? `${sourceAlias}.${quoteIdentifier(ctx.numSerieColumn)}` : 'NULL', 'numSerie');
  append(ctx.numFacturaColumn ? `${sourceAlias}.${quoteIdentifier(ctx.numFacturaColumn)}` : 'NULL', 'numFactura');

  if (ctx.accessKeyFirmaColumn && ctx.joinPair) {
    append(`${firmaAlias}.${quoteIdentifier(ctx.accessKeyFirmaColumn)}`, 'accessKey');
  } else if (ctx.accessKeyVentasColumn) {
    append(`${sourceAlias}.${quoteIdentifier(ctx.accessKeyVentasColumn)}`, 'accessKey');
  } else {
    append("''", 'accessKey');
  }

  append(ctx.dateColumn ? `${sourceAlias}.${quoteIdentifier(ctx.dateColumn)}` : 'NULL', 'invoiceDate');
  append(ctx.timeColumn ? `${sourceAlias}.${quoteIdentifier(ctx.timeColumn)}` : 'NULL', 'invoiceTime');
  append(ctx.vendorColumn ? `${sourceAlias}.${quoteIdentifier(ctx.vendorColumn)}` : "''", 'vendor');
  append(ctx.clientNameColumn ? `${sourceAlias}.${quoteIdentifier(ctx.clientNameColumn)}` : "''", 'clientName');
  append(`${sourceAlias}.${quoteIdentifier(ctx.customerIdColumn)}`, 'clientTaxId');
  append(ctx.totalColumn ? `${sourceAlias}.${quoteIdentifier(ctx.totalColumn)}` : '0', 'total');
  append(ctx.taxColumn ? `${sourceAlias}.${quoteIdentifier(ctx.taxColumn)}` : '0', 'tax');
  append(ctx.currencyColumn ? `${sourceAlias}.${quoteIdentifier(ctx.currencyColumn)}` : "'USD'", 'currency');
  append(ctx.statusColumn ? `${sourceAlias}.${quoteIdentifier(ctx.statusColumn)}` : "'PENDIENTE'", 'status');

  if (ctx.joinPair && ctx.authorizationColumn) {
    append(`${firmaAlias}.${quoteIdentifier(ctx.authorizationColumn)}`, 'authorizationNumber');
  } else {
    append("''", 'authorizationNumber');
  }

  if (ctx.joinPair && ctx.authorizationDateColumn) {
    append(`${firmaAlias}.${quoteIdentifier(ctx.authorizationDateColumn)}`, 'authorizationDate');
  } else {
    append('NULL', 'authorizationDate');
  }

  if (ctx.joinPair && ctx.environmentColumn) {
    append(`${firmaAlias}.${quoteIdentifier(ctx.environmentColumn)}`, 'environment');
  } else {
    append("''", 'environment');
  }

  if (ctx.joinPair && ctx.emissionTypeColumn) {
    append(`${firmaAlias}.${quoteIdentifier(ctx.emissionTypeColumn)}`, 'emissionType');
  } else {
    append("''", 'emissionType');
  }

  if (ctx.joinPair && ctx.firmaTokenColumn) {
    append(`${firmaAlias}.${quoteIdentifier(ctx.firmaTokenColumn)}`, 'firmaToken');
  } else {
    append("''", 'firmaToken');
  }

  if (ctx.joinPair && ctx.pdfUrlColumn) {
    append(`${firmaAlias}.${quoteIdentifier(ctx.pdfUrlColumn)}`, 'pdfSource');
  } else {
    append("''", 'pdfSource');
  }

  if (ctx.joinPair && ctx.xmlUrlColumn) {
    append(`${firmaAlias}.${quoteIdentifier(ctx.xmlUrlColumn)}`, 'xmlSource');
  } else {
    append("''", 'xmlSource');
  }

  if (ctx.joinPair && ctx.pdfContentColumn) {
    append(`${firmaAlias}.${quoteIdentifier(ctx.pdfContentColumn)}`, 'pdfContent');
  } else {
    append('NULL', 'pdfContent');
  }

  if (ctx.joinPair && ctx.xmlContentColumn) {
    append(`${firmaAlias}.${quoteIdentifier(ctx.xmlContentColumn)}`, 'xmlContent');
  } else {
    append('NULL', 'xmlContent');
  }

  const joinClause = ctx.joinPair && ctx.firmaTableRef
    ? `LEFT JOIN ${ctx.firmaTableRef} ${firmaAlias} ON ${sourceAlias}.${quoteIdentifier(ctx.joinPair.ventasColumn)} = ${firmaAlias}.${quoteIdentifier(ctx.joinPair.firmaColumn)}`
    : '';

  const orderBy = ctx.dateColumn
    ? `${sourceAlias}.${quoteIdentifier(ctx.dateColumn)} DESC`
    : `${sourceAlias}.${quoteIdentifier(ctx.idColumn || ctx.customerIdColumn)} DESC`;

  const query = `
    SELECT TOP (500)
      ${selectParts.join(',\n      ')}
    FROM ${ctx.ventasTableRef} ${sourceAlias}
    ${joinClause}
    WHERE ${buildNormalizedTaxIdSql(`${sourceAlias}.${quoteIdentifier(ctx.customerIdColumn)}`)} = @taxIdNormalized
    ORDER BY ${orderBy}
  `;

  const result = await pool
    .request()
    .input('taxIdNormalized', sql.VarChar(40), normalizedTaxId)
    .query(query);

  return result.recordset.map((row) => {
    const invoiceId = String(row.invoiceId || '').trim();
    const accessKey = String(row.accessKey || '').trim();
    const folio = String(row.folio || '').trim();
    const fallbackId = accessKey || folio || `inv-${Math.random().toString(36).slice(2, 10)}`;
    const normalizedId = invoiceId || fallbackId;

    return {
      id: normalizedId,
      folio: folio || normalizedId,
      systemNumber: String(row.systemNumber || normalizedId),
      numSerie: String(row.numSerie || ''),
      numFactura: String(row.numFactura || ''),
      accessKey,
      date: formatDate(row.invoiceDate),
      time: formatTime(row.invoiceTime),
      vendor: String(row.vendor || ''),
      clientName: String(row.clientName || ''),
      clientTaxId: String(row.clientTaxId || ''),
      supplier: 'COMERCIALIZADORA ONI S.A.',
      total: toNumber(row.total),
      tax: toNumber(row.tax),
      currency: String(row.currency || 'USD'),
      status: normalizeStatus(row.status),
      authorizationNumber: String(row.authorizationNumber || ''),
      authorizationDate: formatDate(row.authorizationDate),
      environment: String(row.environment || ''),
      emissionType: String(row.emissionType || ''),
      firmaToken: String(row.firmaToken || ''),
      pdfUrl: `/api/invoices/${encodeURIComponent(normalizedId)}/download/pdf?taxId=${encodeURIComponent(String(taxId))}`,
      xmlUrl: `/api/invoices/${encodeURIComponent(normalizedId)}/download/xml?taxId=${encodeURIComponent(String(taxId))}`,
      pdfSource: row.pdfSource,
      xmlSource: row.xmlSource,
      pdfContent: row.pdfContent,
      xmlContent: row.xmlContent,
      items: []
    };
  });
};

const buildDownloadResponse = async (res, invoice, format, allowPdfToXmlFallback = true) => {
  const isPdf = format === 'pdf';
  if (isPdf) {
    const { serie, factura } = extractSerieFactura(invoice);
    if (serie && factura) {
      const rootPaths = getAuthorizedRootCandidates().filter((rootPath) => fs.existsSync(rootPath));
      const prefixes = [
        String(invoice?.firmaToken || '').trim(),
        String(invoice?.accessKey || '').trim(),
        String(invoice?.authorizationNumber || '').trim()
      ].filter(Boolean);

      const padValues = [9, 8, factura.length];
      for (const rootPath of rootPaths) {
        for (const prefix of prefixes) {
          for (const padValue of padValues) {
            const paddedNumber = factura.padStart(padValue, '0');
            const exactPdfPath = path.join(rootPath, `${prefix}_${serie}_${paddedNumber}.pdf`);
            if (fs.existsSync(exactPdfPath)) {
              return res.download(exactPdfPath, `factura-${invoice.id}.pdf`);
            }
          }
        }
      }
    }
  }

  const source = isPdf ? invoice.pdfSource : invoice.xmlSource;
  const content = isPdf ? invoice.pdfContent : invoice.xmlContent;

  if (source && /^https?:\/\//i.test(String(source))) {
    return res.redirect(String(source));
  }

  if (!isPdf && typeof content === 'string' && content.trim().startsWith('<')) {
    res.setHeader('Content-Type', 'application/xml; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="factura-${invoice.id}.xml"`);
    return res.send(content);
  }

  if (typeof content === 'string' && content.trim().length > 0) {
    try {
      const buffer = Buffer.from(content, 'base64');
      if (buffer.length > 0) {
        res.setHeader('Content-Type', isPdf ? 'application/pdf' : 'application/xml');
        res.setHeader('Content-Disposition', `attachment; filename="factura-${invoice.id}.${isPdf ? 'pdf' : 'xml'}"`);
        return res.send(buffer);
      }
    } catch {
      // continúa a mensaje de no disponible
    }
  }

  const fileInAuthorizedFolder = await findDocumentInAuthorizedFolder(invoice, format);
  if (fileInAuthorizedFolder) {
    const downloadName = `factura-${invoice.id}.${format}`;
    return res.download(fileInAuthorizedFolder, downloadName);
  }

  if (isPdf && allowPdfToXmlFallback) {
    return buildDownloadResponse(res, invoice, 'xml', false);
  }

  return res.status(404).json({ message: `No existe ${format.toUpperCase()} disponible para esta factura.` });
};

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, service: 'auth-api' });
});

app.get('/api/debug/tax-id', async (req, res) => {
  const rawTaxId = req.query.taxId || req.query.cif;
  const taxIdRaw = String(rawTaxId || '').trim();
  const taxIdNormalized = normalizeTaxIdValue(taxIdRaw);

  if (!taxIdPattern.test(taxIdNormalized)) {
    return res.status(400).json({
      ok: false,
      message: 'CÉDULA/RUC/PASAPORTE inválido para diagnóstico.',
      input: {
        raw: taxIdRaw,
        normalized: taxIdNormalized
      }
    });
  }

  try {
    const pool = await getPool();
    const clientesCtx = await resolveClientesIdentityContext(pool, true);
    const clientesSet = toLowerSet(clientesCtx.clientesColumns || []);
    const nameColumn = pickColumn(clientesSet, ['NOMBRECLIENTE', 'NOMBRE', 'RAZONSOCIAL']);
    const codeColumn = pickColumn(clientesSet, ['CODCLIENTE', 'IDCLIENTE', 'ID']);
    const clientesTaxIdSql = buildClientesTaxIdSql('c', clientesCtx.clientesIdColumn, clientesCtx.clientesColumns);
    const normalizedSql = buildNormalizedTaxIdSql(clientesTaxIdSql);

    const selectFields = [
      `${clientesTaxIdSql} AS IDENTIFICACION`,
      `${normalizedSql} AS IDENTIFICACION_NORMALIZADA`
    ];

    if (nameColumn) {
      selectFields.push(`c.${quoteIdentifier(nameColumn)} AS NOMBRECLIENTE`);
    }

    if (codeColumn) {
      selectFields.push(`c.${quoteIdentifier(codeColumn)} AS CODCLIENTE`);
    }

    const result = await pool
      .request()
      .input('taxIdRaw', sql.VarChar(40), taxIdRaw)
      .input('taxIdNormalized', sql.VarChar(40), taxIdNormalized)
      .query(`
        SELECT TOP (20)
          ${selectFields.join(',\n          ')}
        FROM ${clientesCtx.clientesTableRef} c
        WHERE ${normalizedSql} = @taxIdNormalized
           OR UPPER(LTRIM(RTRIM(COALESCE(CAST(${clientesTaxIdSql} AS varchar(40)), '')))) = UPPER(@taxIdRaw)
      `);

    return res.json({
      ok: true,
      input: {
        raw: taxIdRaw,
        normalized: taxIdNormalized
      },
      resolver: {
        table: clientesCtx.clientesTableRef,
        selectedIdColumn: clientesCtx.clientesIdColumn,
        hasNif20: clientesSet.has('nif20'),
        hasCif: clientesSet.has('cif')
      },
      matches: {
        count: result.recordset.length,
        rows: result.recordset
      }
    });
  } catch (error) {
    console.error('Error debug-tax-id:', error);
    return res.status(500).json({
      ok: false,
      message: 'Error ejecutando diagnóstico de identificación.',
      detail: String(error?.message || error)
    });
  }
});

const validateTaxIdHandler = async (req, res) => {
  const rawTaxId = req.body?.taxId ?? req.body?.cif;
  const taxId = normalizeTaxIdValue(rawTaxId);

  if (!taxIdPattern.test(taxId)) {
    return res.status(400).json({ exists: false, message: 'CÉDULA/RUC/PASAPORTE inválido.' });
  }

  try {
    const pool = await getPool();
    const clientesCtx = await resolveClientesIdentityContext(pool, true);
    const clientesTaxIdSql = buildClientesTaxIdSql('c', clientesCtx.clientesIdColumn, clientesCtx.clientesColumns);
    const result = await pool
      .request()
      .input('taxIdNormalized', sql.VarChar(40), taxId)
      .query(`SELECT TOP (1) ${clientesTaxIdSql} AS IDENTIFICACION FROM ${clientesCtx.clientesTableRef} c WHERE ${buildNormalizedTaxIdSql(clientesTaxIdSql)} = @taxIdNormalized`);

    return res.json({ exists: result.recordset.length > 0 });
  } catch (error) {
    console.error('Error validate-tax-id:', error);
    return res.status(500).json({ exists: false, message: 'Error validando identificación en base de datos.' });
  }
};

app.post('/api/auth/validate-tax-id', validateTaxIdHandler);
app.post('/api/auth/validate-cif', validateTaxIdHandler);

app.post('/api/auth/change-password', async (req, res) => {
  const rawTaxId = req.body?.taxId ?? req.body?.cif;
  const { currentPassword, newPassword } = req.body ?? {};
  const taxIdKey = normalizeTaxIdValue(rawTaxId);
  const currentPasswordValue = String(currentPassword || '').trim();
  const newPasswordValue = String(newPassword || '').trim();

  if (!taxIdPattern.test(taxIdKey)) {
    return res.status(400).json({ ok: false, message: 'CÉDULA/RUC/PASAPORTE inválido.' });
  }

  if (!passwordPattern.test(currentPasswordValue)) {
    return res.status(400).json({ ok: false, message: 'La contraseña actual debe tener 7 dígitos.' });
  }

  if (!passwordPattern.test(newPasswordValue)) {
    return res.status(400).json({ ok: false, message: 'La nueva contraseña debe tener 7 dígitos.' });
  }

  try {
    const pool = await getPool();
    const clientesCtx = await resolveClientesIdentityContext(pool, true);
    const clientesTaxIdSql = buildClientesTaxIdSql('c', clientesCtx.clientesIdColumn, clientesCtx.clientesColumns);
    const result = await pool
      .request()
      .input('taxIdNormalized', sql.VarChar(40), taxIdKey)
      .query(`SELECT TOP (1) ${clientesTaxIdSql} AS IDENTIFICACION FROM ${clientesCtx.clientesTableRef} c WHERE ${buildNormalizedTaxIdSql(clientesTaxIdSql)} = @taxIdNormalized`);

    if (result.recordset.length === 0) {
      return res.status(404).json({ ok: false, message: 'La identificación no existe en CLIENTES.' });
    }

    const genericPassword = taxIdKey.substring(0, 7);
    const currentCustomPassword = passwordOverrideByTaxId.get(taxIdKey);
    const expectedCurrentPassword = currentCustomPassword || genericPassword;

    if (currentPasswordValue !== expectedCurrentPassword) {
      return res.status(401).json({ ok: false, message: 'La contraseña actual no coincide.' });
    }

    passwordOverrideByTaxId.set(taxIdKey, newPasswordValue);
    failedPasswordAttemptsByTaxId.delete(taxIdKey);

    return res.json({ ok: true, message: 'Contraseña actualizada correctamente.' });
  } catch (error) {
    console.error('Error change-password:', error);
    return res.status(500).json({ ok: false, message: 'Error actualizando contraseña.' });
  }
});

app.post('/api/auth/reset-to-generic', async (req, res) => {
  const rawTaxId = req.body?.taxId ?? req.body?.cif;
  const { genericPassword } = req.body ?? {};
  const taxIdKey = normalizeTaxIdValue(rawTaxId);
  const genericPasswordValue = String(genericPassword || '').trim();

  if (!taxIdPattern.test(taxIdKey)) {
    return res.status(400).json({ ok: false, message: 'CÉDULA/RUC/PASAPORTE inválido.' });
  }

  if (!passwordPattern.test(genericPasswordValue)) {
    return res.status(400).json({ ok: false, message: 'La clave genérica debe tener 7 dígitos.' });
  }

  const expectedGenericPassword = taxIdKey.substring(0, 7);
  if (genericPasswordValue !== expectedGenericPassword) {
    return res.status(401).json({ ok: false, message: 'La clave genérica no es válida.' });
  }

  passwordOverrideByTaxId.delete(taxIdKey);
  failedPasswordAttemptsByTaxId.delete(taxIdKey);

  return res.json({ ok: true, message: 'Contraseña restablecida a la clave genérica.' });
});

app.post('/api/auth/validate-password', async (req, res) => {
  const rawTaxId = req.body?.taxId ?? req.body?.cif;
  const { password } = req.body ?? {};
  const taxIdKey = normalizeTaxIdValue(rawTaxId);

  if (!taxIdPattern.test(taxIdKey)) {
    return res.status(400).json({ valid: false, message: 'CÉDULA/RUC/PASAPORTE inválido.' });
  }

  const currentAttempts = failedPasswordAttemptsByTaxId.get(taxIdKey) || 0;
  if (currentAttempts >= maxPasswordAttempts) {
    return res.status(429).json({
      valid: false,
      remainingAttempts: 0,
      message: 'Ha excedido el máximo de 5 intentos de contraseña.'
    });
  }

  if (!passwordPattern.test(String(password || ''))) {
    return res.status(400).json({
      valid: false,
      remainingAttempts: maxPasswordAttempts - currentAttempts,
      message: 'La contraseña debe tener 7 dígitos.'
    });
  }

  try {
    const pool = await getPool();
    const clientesCtx = await resolveClientesIdentityContext(pool, true);
    const clientesTaxIdSql = buildClientesTaxIdSql('c', clientesCtx.clientesIdColumn, clientesCtx.clientesColumns);
    const fidelizadoColumn = resolveFidelizadoColumn(clientesCtx.clientesColumns);
    const fidelizadoSql = fidelizadoColumn ? `c.${quoteIdentifier(fidelizadoColumn)}` : 'NULL';
    const result = await pool
      .request()
      .input('taxIdNormalized', sql.VarChar(40), taxIdKey)
      .query(`
        SELECT TOP (1)
          ${clientesTaxIdSql} AS IDENTIFICACION,
          ${fidelizadoSql} AS FIDELIZADO
        FROM ${clientesCtx.clientesTableRef} c
        WHERE ${buildNormalizedTaxIdSql(clientesTaxIdSql)} = @taxIdNormalized
      `);

    if (result.recordset.length === 0) {
      return res.status(404).json({
        valid: false,
        remainingAttempts: maxPasswordAttempts - currentAttempts,
        message: 'La identificación no existe en CLIENTES.'
      });
    }

    const genericPassword = taxIdKey.substring(0, 7);
    const customPassword = passwordOverrideByTaxId.get(taxIdKey);
    const expectedPassword = customPassword || genericPassword;
    const valid = String(password) === expectedPassword;

    if (!valid) {
      const newAttempts = currentAttempts + 1;
      failedPasswordAttemptsByTaxId.set(taxIdKey, newAttempts);

      return res.status(401).json({
        valid: false,
        remainingAttempts: Math.max(0, maxPasswordAttempts - newAttempts),
        message: `Contraseña incorrecta. Intentos restantes: ${Math.max(0, maxPasswordAttempts - newAttempts)}.`
      });
    }

    failedPasswordAttemptsByTaxId.delete(taxIdKey);
    const fidelizado = parseBooleanDbValue(result.recordset[0]?.FIDELIZADO) || privacyConsentByTaxId.get(taxIdKey) === true;

    return res.json({
      valid: true,
      fidelizado,
      remainingAttempts: maxPasswordAttempts,
      customPasswordActive: Boolean(customPassword)
    });
  } catch (error) {
    console.error('Error validate-password:', error);
    return res.status(500).json({
      valid: false,
      remainingAttempts: maxPasswordAttempts - currentAttempts,
      message: 'Error validando contraseña.'
    });
  }
});

app.post('/api/auth/privacy-consent', async (req, res) => {
  const rawTaxId = req.body?.taxId ?? req.body?.cif;
  const taxId = normalizeTaxIdValue(rawTaxId);
  const accepted = req.body?.accepted === true;

  if (!taxIdPattern.test(taxId)) {
    return res.status(400).json({ ok: false, message: 'CÉDULA/RUC/PASAPORTE inválido.' });
  }

  if (!accepted) {
    return res.status(400).json({ ok: false, message: 'Debe aceptar el tratamiento de datos personales.' });
  }

  try {
    const pool = await getPool();
    const clientesCtx = await resolveClientesIdentityContext(pool, true);
    const clientesTaxIdSql = buildClientesTaxIdSql('c', clientesCtx.clientesIdColumn, clientesCtx.clientesColumns);
    const clientesSet = toLowerSet(clientesCtx.clientesColumns || []);

    const fidelizadoColumn = resolveFidelizadoColumn(clientesCtx.clientesColumns);
    const privacyAcceptedColumn = pickColumn(clientesSet, ['ACEPTATRATAMIENTODATOS', 'PRIVACYACCEPTED', 'ACEPTADATOS']);
    const privacyTimestampColumn = pickColumn(clientesSet, ['FECHAACEPTACIONDATOS', 'FECHAACEPTACION', 'PRIVACYACCEPTEDAT']);

    const setClauses = [];
    if (fidelizadoColumn) {
      setClauses.push(`${quoteIdentifier(fidelizadoColumn)} = 1`);
    }
    if (privacyAcceptedColumn) {
      setClauses.push(`${quoteIdentifier(privacyAcceptedColumn)} = 1`);
    }
    if (privacyTimestampColumn) {
      setClauses.push(`${quoteIdentifier(privacyTimestampColumn)} = GETDATE()`);
    }

    if (setClauses.length === 0) {
      privacyConsentByTaxId.set(taxId, true);
      return res.json({ ok: true, fidelizado: true, persistedInDatabase: false });
    }

    const updateResult = await pool
      .request()
      .input('taxIdNormalized', sql.VarChar(40), taxId)
      .query(`
        UPDATE c
        SET ${setClauses.join(',\n            ')}
        FROM ${clientesCtx.clientesTableRef} c
        WHERE ${buildNormalizedTaxIdSql(clientesTaxIdSql)} = @taxIdNormalized
      `);

    if ((updateResult.rowsAffected?.[0] || 0) === 0) {
      return res.status(404).json({ ok: false, message: 'Cliente no encontrado para registrar consentimiento.' });
    }

    privacyConsentByTaxId.set(taxId, true);
    return res.json({ ok: true, fidelizado: true, persistedInDatabase: true });
  } catch (error) {
    console.error('Error privacy-consent:', error);
    privacyConsentByTaxId.set(taxId, true);
    return res.json({ ok: true, fidelizado: true, persistedInDatabase: false });
  }
});

app.get('/api/client-profile', async (req, res) => {
  const rawTaxId = req.query.taxId || req.query.cif;
  const taxId = normalizeTaxIdValue(rawTaxId);

  if (!taxIdPattern.test(taxId)) {
    return res.status(400).json({ message: 'CÉDULA/RUC/PASAPORTE inválido.' });
  }

  try {
    const pool = await getPool();
    const clientesCtx = await resolveClientesIdentityContext(pool, true);
    const clientesTaxIdSql = buildClientesTaxIdSql('c', clientesCtx.clientesIdColumn, clientesCtx.clientesColumns);
    const result = await pool
      .request()
      .input('taxIdNormalized', sql.VarChar(40), taxId)
      .query(`
        SELECT TOP (1)
          c.NOMBRECLIENTE,
          ${clientesTaxIdSql} AS IDENTIFICACION,
          c.E_MAIL,
          c.DIRECCION1,
          c.CODPOSTAL
        FROM ${clientesCtx.clientesTableRef} c
        WHERE ${buildNormalizedTaxIdSql(clientesTaxIdSql)} = @taxIdNormalized
      `);

    if (result.recordset.length === 0) {
      return res.status(404).json({ message: 'Cliente no encontrado.' });
    }

    const client = result.recordset[0];
    return res.json({
      client: {
        fullName: String(client.NOMBRECLIENTE || '').trim(),
        taxId: String(client.IDENTIFICACION || '').trim(),
        email: String(client.E_MAIL || '').trim(),
        address: String(client.DIRECCION1 || '').trim(),
        postalCode: String(client.CODPOSTAL || '').trim()
      }
    });
  } catch (error) {
    console.error('Error client-profile:', error);
    return res.status(500).json({ message: 'Error consultando datos del cliente.' });
  }
});

app.put('/api/client-profile/address', async (req, res) => {
  const rawTaxId = req.body?.taxId ?? req.body?.cif;
  const taxId = normalizeTaxIdValue(rawTaxId);
  const address = String(req.body?.address || '').trim();
  const postalCode = String(req.body?.postalCode || '').trim();

  if (!taxIdPattern.test(taxId)) {
    return res.status(400).json({ message: 'CÉDULA/RUC/PASAPORTE inválido.' });
  }

  if (!address) {
    return res.status(400).json({ message: 'La dirección es obligatoria.' });
  }

  if (!postalCode) {
    return res.status(400).json({ message: 'El código postal es obligatorio.' });
  }

  try {
    const pool = await getPool();
    const clientesCtx = await resolveClientesIdentityContext(pool, true);
    const clientesTaxIdSql = buildClientesTaxIdSql('c', clientesCtx.clientesIdColumn, clientesCtx.clientesColumns);
    const updateResult = await pool
      .request()
      .input('taxIdNormalized', sql.VarChar(40), taxId)
      .input('address', sql.VarChar(sql.MAX), address)
      .input('postalCode', sql.VarChar(20), postalCode)
      .query(`
        UPDATE c
        SET DIRECCION1 = @address,
            CODPOSTAL = @postalCode
        FROM ${clientesCtx.clientesTableRef} c
        WHERE ${buildNormalizedTaxIdSql(clientesTaxIdSql)} = @taxIdNormalized
      `);

    if ((updateResult.rowsAffected?.[0] || 0) === 0) {
      return res.status(404).json({ message: 'Cliente no encontrado para actualización.' });
    }

    return res.json({ ok: true });
  } catch (error) {
    console.error('Error update client address:', error);
    return res.status(500).json({ message: 'Error actualizando dirección del cliente.' });
  }
});

app.get('/api/invoices', async (req, res) => {
  const rawTaxId = req.query.taxId || req.query.cif;
  const taxId = normalizeTaxIdValue(rawTaxId);

  if (!taxIdPattern.test(taxId)) {
    return res.status(400).json({ message: 'CÉDULA/RUC/PASAPORTE inválido para consulta de facturas.' });
  }

  try {
    const pool = await getPool();
    const invoices = await fetchInvoicesByTaxId(pool, taxId);

    return res.json({ invoices });
  } catch (error) {
    console.error('Error list invoices:', error);
    return res.status(500).json({ message: 'Error consultando facturas del cliente.' });
  }
});

app.get('/api/invoices/:invoiceId/download/:format', async (req, res) => {
  const rawTaxId = req.query.taxId || req.query.cif;
  const taxId = normalizeTaxIdValue(rawTaxId);
  const invoiceId = String(req.params.invoiceId || '').trim();
  const format = String(req.params.format || '').toLowerCase();

  if (!taxIdPattern.test(taxId)) {
    return res.status(400).json({ message: 'CÉDULA/RUC/PASAPORTE inválido.' });
  }

  if (!['pdf', 'xml'].includes(format)) {
    return res.status(400).json({ message: 'Formato no soportado.' });
  }

  try {
    const pool = await getPool();
    const invoices = await fetchInvoicesByTaxId(pool, taxId);
    const invoice = invoices.find((current) => String(current.id) === invoiceId);

    if (!invoice) {
      return res.status(404).json({ message: 'Factura no encontrada para el cliente.' });
    }

    return await buildDownloadResponse(res, invoice, format);
  } catch (error) {
    console.error(`Error download ${format}:`, error);
    return res.status(500).json({ message: `Error generando descarga ${format.toUpperCase()}.` });
  }
});

if (serveStatic && fs.existsSync(distPath)) {
  app.use(express.static(distPath));

  app.get(/^\/(?!api).*/, (_req, res) => {
    res.sendFile(path.join(distPath, 'index.html'));
  });
}

const server = http.createServer(app);

server.on('error', (error) => {
  const allowPortInUse = String(process.env.ALLOW_PORT_IN_USE || 'false').toLowerCase() === 'true';

  if (error?.code === 'EADDRINUSE' && allowPortInUse) {
    console.log(`El puerto ${port} ya está en uso. Se asume API activa y se omite nuevo arranque.`);
    process.exit(0);
  }

  throw error;
});

server.listen(port, () => {
  console.log(`Auth API ejecutándose en http://localhost:${port}`);
  if (serveStatic) {
    console.log(`Frontend estático servido desde ${distPath}`);
  }
});
