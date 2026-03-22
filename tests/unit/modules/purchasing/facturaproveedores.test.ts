import { describe, it, expect, vi, beforeEach } from 'vitest';
import { FacturaproveedoresResource } from '../../../../src/modules/purchasing/facturaproveedores/resource.js';
import { createFacturaProveedorImplementation } from '../../../../src/modules/purchasing/facturaproveedores/tool.js';
import type { FacturaProveedor } from '../../../../src/types/facturascripts.js';

describe('FacturaproveedoresResource', () => {
  let mockClient: any;
  let facturaproveedoresResource: FacturaproveedoresResource;

  beforeEach(() => {
    vi.clearAllMocks();
    mockClient = {
      getWithPagination: vi.fn()
    };
    facturaproveedoresResource = new FacturaproveedoresResource(mockClient);
  });

  describe('matchesUri', () => {
    it('should match valid facturascripts://facturaproveedores URIs', () => {
      expect(facturaproveedoresResource.matchesUri('facturascripts://facturaproveedores')).toBe(true);
      expect(facturaproveedoresResource.matchesUri('facturascripts://facturaproveedores?limit=10')).toBe(true);
      expect(facturaproveedoresResource.matchesUri('facturascripts://facturaproveedores?limit=10&offset=20')).toBe(true);
    });

    it('should not match invalid URIs', () => {
      expect(facturaproveedoresResource.matchesUri('facturascripts://facturaclientes')).toBe(false);
      expect(facturaproveedoresResource.matchesUri('https://example.com')).toBe(false);
      expect(facturaproveedoresResource.matchesUri('invalid-uri')).toBe(false);
    });
  });

  describe('getResource', () => {
    const mockFacturas: FacturaProveedor[] = [
      {
        idfactura: 1,
        codigo: 'FPROV001',
        numproveedor: 'FP-2024-001',
        codproveedor: 'PROV001',
        nombre: 'Proveedor Test S.L.',
        cifnif: '12345678A',
        fecha: '2024-01-15',
        hora: '10:30:00',
        codalmacen: 'ALM001',
        coddivisa: 'EUR',
        tasaconv: 1,
        codpago: 'CONT',
        total: 1210.00,
        totaliva: 210.00,
        totalirpf: 0,
        totalrecargo: 0,
        neto: 1000.00,
        observaciones: 'Factura de prueba',
        fechavencimiento: '2024-02-15',
        pagada: false,
        anulada: false,
        editable: true,
      },
      {
        idfactura: 2,
        codigo: 'FPROV002',
        numproveedor: 'FP-2024-002',
        codproveedor: 'PROV002',
        nombre: 'Otro Proveedor S.A.',
        cifnif: '87654321B',
        fecha: '2024-01-20',
        hora: '14:15:00',
        codalmacen: 'ALM001',
        coddivisa: 'EUR',
        tasaconv: 1,
        codpago: 'TRANS',
        total: 605.00,
        totaliva: 105.00,
        totalirpf: 0,
        totalrecargo: 0,
        neto: 500.00,
        observaciones: 'Segunda factura de prueba',
        fechavencimiento: '2024-02-20',
        pagada: true,
        anulada: false,
        editable: false,
      },
    ];

    const mockPaginatedResponse = {
      meta: {
        total: 2,
        limit: 50,
        offset: 0,
        hasMore: false,
      },
      data: mockFacturas,
    };

    it('should return factura proveedores data with default pagination', async () => {
      mockClient.getWithPagination.mockResolvedValue(mockPaginatedResponse);

      const result = await facturaproveedoresResource.getResource('facturascripts://facturaproveedores');

      expect(mockClient.getWithPagination).toHaveBeenCalledWith('/facturaproveedores', 50, 0, {});
      expect(result).toEqual({
        uri: 'facturascripts://facturaproveedores',
        name: 'FacturaScripts FacturaProveedores',
        mimeType: 'application/json',
        contents: [
          {
            type: 'text',
            text: JSON.stringify(mockPaginatedResponse, null, 2),
            uri: 'facturascripts://facturaproveedores',
          },
        ],
      });
    });

    it('should parse and use limit and offset from URI', async () => {
      mockClient.getWithPagination.mockResolvedValue({
        ...mockPaginatedResponse,
        meta: { ...mockPaginatedResponse.meta, limit: 20, offset: 5 },
      });

      const result = await facturaproveedoresResource.getResource('facturascripts://facturaproveedores?limit=20&offset=5');

      expect(mockClient.getWithPagination).toHaveBeenCalledWith('/facturaproveedores', 20, 5, {});
      expect(result.contents[0].text).toContain('"limit": 20');
      expect(result.contents[0].text).toContain('"offset": 5');
    });

    it('should handle API errors gracefully', async () => {
      const errorMessage = 'FacturaProveedores API connection failed';
      mockClient.getWithPagination.mockRejectedValue(new Error(errorMessage));

      const result = await facturaproveedoresResource.getResource('facturascripts://facturaproveedores');

      expect(result.name).toBe('FacturaScripts FacturaProveedores (Error)');
      expect(result.contents[0].text).toContain('Failed to fetch facturaproveedores');
      expect(result.contents[0].text).toContain(errorMessage);
    });
  });
});

describe('createFacturaProveedorImplementation', () => {
  let mockClient: any;

  const validArgs = {
    codproveedor: 'PROV001',
    lineas: [{ descripcion: 'Servicio consultoria', cantidad: 1, pvpunitario: 100 }],
  };

  const mockCrearResponse = {
    doc: {
      idfactura: '14',
      codigo: 'FPROV001',
      codproveedor: 'PROV001',
      fecha: '2026-03-22',
      neto: 100,
      totaliva: 21,
      total: 121,
      pagada: false,
    },
    lines: [{ idlinea: 1, descripcion: 'Servicio consultoria', cantidad: 1, pvpunitario: 100 }],
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockClient = {
      post: vi.fn(),
      get: vi.fn(),
    };
  });

  describe('validation', () => {
    it('should return error when codproveedor is missing', async () => {
      const result = await createFacturaProveedorImplementation(
        { lineas: [{ descripcion: 'Test', cantidad: 1, pvpunitario: 10 }] },
        mockClient
      );
      const response = JSON.parse(result.content[0].text);

      expect(result.isError).toBe(true);
      expect(response.message).toContain('codproveedor');
    });

    it('should return error when codproveedor is empty/whitespace', async () => {
      const result = await createFacturaProveedorImplementation(
        { codproveedor: '  ', lineas: [{ descripcion: 'Test', cantidad: 1, pvpunitario: 10 }] },
        mockClient
      );

      expect(result.isError).toBe(true);
    });

    it('should return error when lineas is missing', async () => {
      const result = await createFacturaProveedorImplementation(
        { codproveedor: 'PROV001' },
        mockClient
      );
      const response = JSON.parse(result.content[0].text);

      expect(result.isError).toBe(true);
      expect(response.message).toContain('línea');
    });

    it('should return error when lineas is empty array', async () => {
      const result = await createFacturaProveedorImplementation(
        { codproveedor: 'PROV001', lineas: [] },
        mockClient
      );

      expect(result.isError).toBe(true);
    });

    it('should return error when lineas is not an array', async () => {
      const result = await createFacturaProveedorImplementation(
        { codproveedor: 'PROV001', lineas: 'not-an-array' },
        mockClient
      );

      expect(result.isError).toBe(true);
    });

    it('should return error when line has no descripcion', async () => {
      const result = await createFacturaProveedorImplementation(
        { codproveedor: 'PROV001', lineas: [{ cantidad: 1, pvpunitario: 10 }] },
        mockClient
      );
      const response = JSON.parse(result.content[0].text);

      expect(result.isError).toBe(true);
      expect(response.message).toContain('Línea 1');
      expect(response.message).toContain('descripción');
    });

    it('should return error when line has cantidad <= 0', async () => {
      const result = await createFacturaProveedorImplementation(
        { codproveedor: 'PROV001', lineas: [{ descripcion: 'Test', cantidad: 0, pvpunitario: 10 }] },
        mockClient
      );
      const response = JSON.parse(result.content[0].text);

      expect(result.isError).toBe(true);
      expect(response.message).toContain('Línea 1');
      expect(response.message).toContain('cantidad');
    });

    it('should return error when line has negative pvpunitario', async () => {
      const result = await createFacturaProveedorImplementation(
        { codproveedor: 'PROV001', lineas: [{ descripcion: 'Test', cantidad: 1, pvpunitario: -5 }] },
        mockClient
      );
      const response = JSON.parse(result.content[0].text);

      expect(result.isError).toBe(true);
      expect(response.message).toContain('Línea 1');
      expect(response.message).toContain('precio unitario');
    });
  });

  describe('success without payment', () => {
    it('should create invoice with minimal required fields', async () => {
      mockClient.post.mockResolvedValue(mockCrearResponse);

      const result = await createFacturaProveedorImplementation(validArgs, mockClient);
      const response = JSON.parse(result.content[0].text);

      expect(result.isError).toBeUndefined();
      expect(response.success).toBe(true);
      expect(response.resumen.idfactura).toBe(14);
      expect(response.resumen.codproveedor).toBe('PROV001');
      expect(response.resumen.num_lineas).toBe(1);
      expect(response.lineas).toHaveLength(1);

      // Verify POST was called with correct endpoint and serialized lineas
      expect(mockClient.post).toHaveBeenCalledWith(
        '/crearFacturaProveedor',
        expect.objectContaining({
          codproveedor: 'PROV001',
          lineas: expect.any(String),
        })
      );

      // Verify lineas was JSON-stringified
      const sentData = mockClient.post.mock.calls[0][1];
      const parsedLineas = JSON.parse(sentData.lineas);
      expect(parsedLineas[0].descripcion).toBe('Servicio consultoria');
    });

    it('should create invoice with all optional header fields', async () => {
      mockClient.post.mockResolvedValue(mockCrearResponse);

      await createFacturaProveedorImplementation({
        ...validArgs,
        fecha: '2026-01-15',
        numproveedor: 'FP-2026-001',
        codalmacen: 'ALG',
        codpago: 'TRANS',
        codserie: 'A',
        observaciones: 'Test invoice',
      }, mockClient);

      const sentData = mockClient.post.mock.calls[0][1];
      expect(sentData.fecha).toBe('2026-01-15');
      expect(sentData.numproveedor).toBe('FP-2026-001');
      expect(sentData.codalmacen).toBe('ALG');
      expect(sentData.codpago).toBe('TRANS');
      expect(sentData.codserie).toBe('A');
      expect(sentData.observaciones).toBe('Test invoice');
    });

    it('should create invoice with multiple lines', async () => {
      mockClient.post.mockResolvedValue({
        doc: { ...mockCrearResponse.doc, neto: 250, totaliva: 52.5, total: 302.5 },
        lines: [
          { idlinea: 1, descripcion: 'Item 1', cantidad: 2, pvpunitario: 50 },
          { idlinea: 2, descripcion: 'Item 2', cantidad: 1, pvpunitario: 150, referencia: 'REF002' },
        ],
      });

      const result = await createFacturaProveedorImplementation({
        codproveedor: 'PROV001',
        lineas: [
          { descripcion: 'Item 1', cantidad: 2, pvpunitario: 50 },
          { descripcion: 'Item 2', cantidad: 1, pvpunitario: 150, referencia: 'REF002', codimpuesto: 'IVA21', dtopor: 10 },
        ],
      }, mockClient);
      const response = JSON.parse(result.content[0].text);

      expect(response.resumen.num_lineas).toBe(2);
    });

    it('should use today date when fecha is not provided', async () => {
      mockClient.post.mockResolvedValue(mockCrearResponse);

      await createFacturaProveedorImplementation(validArgs, mockClient);

      const sentData = mockClient.post.mock.calls[0][1];
      const today = new Date().toISOString().split('T')[0];
      expect(sentData.fecha).toBe(today);
    });

    it('should return error when idfactura is missing in response', async () => {
      mockClient.post.mockResolvedValue({ doc: {} });

      const result = await createFacturaProveedorImplementation(validArgs, mockClient);
      const response = JSON.parse(result.content[0].text);

      expect(result.isError).toBe(true);
      expect(response.message).toContain('idfactura');
    });
  });

  describe('success with pagada=true', () => {
    it('should mark invoice as paid via dedicated endpoint', async () => {
      mockClient.post
        .mockResolvedValueOnce(mockCrearResponse) // crearFacturaProveedor
        .mockResolvedValueOnce({ success: true }); // pagarFacturaProveedor
      mockClient.get.mockResolvedValue({ ...mockCrearResponse.doc, pagada: true });

      const result = await createFacturaProveedorImplementation(
        { ...validArgs, pagada: true },
        mockClient
      );
      const response = JSON.parse(result.content[0].text);

      expect(mockClient.post).toHaveBeenCalledTimes(2);
      expect(mockClient.post.mock.calls[1][0]).toBe('/pagarFacturaProveedor/14');
      expect(response.pago.success).toBe(true);
      expect(mockClient.get).toHaveBeenCalledWith('/facturaproveedores/14');
    });

    it('should handle payment endpoint failure gracefully', async () => {
      mockClient.post
        .mockResolvedValueOnce(mockCrearResponse) // crearFacturaProveedor
        .mockRejectedValueOnce(new Error('Payment failed')); // pagarFacturaProveedor

      const result = await createFacturaProveedorImplementation(
        { ...validArgs, pagada: true },
        mockClient
      );
      const response = JSON.parse(result.content[0].text);

      expect(response.success).toBe(true);
      expect(response.pago.error).toContain('Payment failed');
    });

    it('should handle re-fetch failure after payment', async () => {
      mockClient.post
        .mockResolvedValueOnce(mockCrearResponse)
        .mockResolvedValueOnce({ success: true });
      mockClient.get.mockRejectedValue(new Error('Re-fetch failed'));

      const result = await createFacturaProveedorImplementation(
        { ...validArgs, pagada: true },
        mockClient
      );
      const response = JSON.parse(result.content[0].text);

      // Should still succeed, using original entity data
      expect(response.success).toBe(true);
      expect(response.pago.success).toBe(true);
      expect(response.resumen.idfactura).toBe(14);
    });

    it('should not attempt payment when pagada is false', async () => {
      mockClient.post.mockResolvedValue(mockCrearResponse);

      await createFacturaProveedorImplementation(
        { ...validArgs, pagada: false },
        mockClient
      );

      expect(mockClient.post).toHaveBeenCalledTimes(1);
      expect(mockClient.get).not.toHaveBeenCalled();
    });
  });

  describe('error handling', () => {
    it('should handle API errors during invoice creation', async () => {
      mockClient.post.mockRejectedValue(new Error('API timeout'));

      const result = await createFacturaProveedorImplementation(validArgs, mockClient);
      const response = JSON.parse(result.content[0].text);

      expect(result.isError).toBe(true);
      expect(response.error).toBe('Error al crear factura de proveedor');
      expect(response.message).toBe('API timeout');
    });

    it('should include API response details in error', async () => {
      const axiosError: any = new Error('Bad Request');
      axiosError.response = { data: { message: 'Proveedor no encontrado' } };
      mockClient.post.mockRejectedValue(axiosError);

      const result = await createFacturaProveedorImplementation(validArgs, mockClient);
      const response = JSON.parse(result.content[0].text);

      expect(response.details).toEqual({ message: 'Proveedor no encontrado' });
    });
  });
});