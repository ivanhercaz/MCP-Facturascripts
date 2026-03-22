import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ProveedoresResource } from '../../../../src/modules/core-business/proveedores/resource.js';
import { createProveedorImplementation } from '../../../../src/modules/core-business/proveedores/tool.js';
import type { Proveedor } from '../../../../src/types/facturascripts.js';

describe('ProveedoresResource', () => {
  let mockClient: any;
  let proveedoresResource: ProveedoresResource;

  beforeEach(() => {
    vi.clearAllMocks();
    mockClient = {
      getWithPagination: vi.fn()
    };
    proveedoresResource = new ProveedoresResource(mockClient);
  });

  describe('matchesUri', () => {
    it('should match valid facturascripts://proveedores URIs', () => {
      expect(proveedoresResource.matchesUri('facturascripts://proveedores')).toBe(true);
      expect(proveedoresResource.matchesUri('facturascripts://proveedores?limit=10')).toBe(true);
      expect(proveedoresResource.matchesUri('facturascripts://proveedores?limit=10&offset=20')).toBe(true);
    });

    it('should not match invalid URIs', () => {
      expect(proveedoresResource.matchesUri('facturascripts://clientes')).toBe(false);
      expect(proveedoresResource.matchesUri('https://example.com')).toBe(false);
      expect(proveedoresResource.matchesUri('invalid-uri')).toBe(false);
    });
  });

  describe('getResource', () => {
    const mockProveedores: Proveedor[] = [
      {
        codproveedor: 'PROV001',
        nombre: 'Proveedor Test 1',
        razonsocial: 'Test Provider S.L.',
        cifnif: '12345678A',
        telefono1: '123456789',
        email: 'test1@provider.com',
        activo: true,
        fechaalta: '2024-01-15',
      },
      {
        codproveedor: 'PROV002',
        nombre: 'Proveedor Test 2',
        razonsocial: 'Another Provider S.A.',
        cifnif: '87654321B',
        telefono1: '987654321',
        email: 'test2@provider.com',
        activo: true,
        fechaalta: '2024-02-20',
      },
    ];

    const mockPaginatedResponse = {
      meta: {
        total: 2,
        limit: 50,
        offset: 0,
        hasMore: false,
      },
      data: mockProveedores,
    };

    it('should return proveedores data with default pagination', async () => {
      mockClient.getWithPagination.mockResolvedValue(mockPaginatedResponse);

      const result = await proveedoresResource.getResource('facturascripts://proveedores');

      expect(mockClient.getWithPagination).toHaveBeenCalledTimes(1);
      expect(mockClient.getWithPagination).toHaveBeenCalledWith('/proveedores', 50, 0, {});
      expect(result).toEqual({
        uri: 'facturascripts://proveedores',
        name: 'FacturaScripts Proveedores',
        mimeType: 'application/json',
        contents: [
          {
            type: 'text',
            text: JSON.stringify(mockPaginatedResponse, null, 2),
            uri: 'facturascripts://proveedores',
          },
        ],
      });
    });

    it('should parse and use limit and offset from URI', async () => {
      const modifiedResponse = {
        ...mockPaginatedResponse,
        meta: { ...mockPaginatedResponse.meta, limit: 10, offset: 20 },
      };
      mockClient.getWithPagination.mockResolvedValue(modifiedResponse);

      const result = await proveedoresResource.getResource('facturascripts://proveedores?limit=10&offset=20');

      expect(mockClient.getWithPagination).toHaveBeenCalledTimes(1);
      expect(mockClient.getWithPagination).toHaveBeenCalledWith('/proveedores', 10, 20, {});
      expect(result.contents[0].text).toContain('"limit": 10');
      expect(result.contents[0].text).toContain('"offset": 20');
    });

    it('should handle invalid limit and offset parameters', async () => {
      mockClient.getWithPagination.mockResolvedValue(mockPaginatedResponse);

      await proveedoresResource.getResource('facturascripts://proveedores?limit=invalid&offset=also-invalid');

      expect(mockClient.getWithPagination).toHaveBeenCalledTimes(1);
      expect(mockClient.getWithPagination).toHaveBeenCalledWith('/proveedores', 50, 0, {});
    });

    it('should handle API errors gracefully', async () => {
      const errorMessage = 'API connection failed';
      mockClient.getWithPagination.mockRejectedValue(new Error(errorMessage));

      const result = await proveedoresResource.getResource('facturascripts://proveedores');

      expect(mockClient.getWithPagination).toHaveBeenCalledTimes(1);
      expect(result.name).toBe('FacturaScripts Proveedores (Error)');
      expect(result.contents[0].text).toContain('Failed to fetch proveedores');
      expect(result.contents[0].text).toContain(errorMessage);
    });

    it('should handle non-Error exceptions', async () => {
      mockClient.getWithPagination.mockRejectedValue('String error');

      const result = await proveedoresResource.getResource('facturascripts://proveedores');

      expect(mockClient.getWithPagination).toHaveBeenCalledTimes(1);
      expect(result.name).toBe('FacturaScripts Proveedores (Error)');
      expect(result.contents[0].text).toContain('Unknown error');
    });
  });
});

describe('createProveedorImplementation', () => {
  let mockClient: any;

  beforeEach(() => {
    vi.clearAllMocks();
    mockClient = {
      post: vi.fn(),
      put: vi.fn(),
    };
  });

  describe('validation', () => {
    it('should return error when nombre is missing', async () => {
      const result = await createProveedorImplementation({ cifnif: 'B12345' }, mockClient);
      const response = JSON.parse(result.content[0].text);

      expect(result.isError).toBe(true);
      expect(response.message).toContain('nombre');
    });

    it('should return error when nombre is empty/whitespace', async () => {
      const result = await createProveedorImplementation({ nombre: '   ', cifnif: 'B12345' }, mockClient);

      expect(result.isError).toBe(true);
    });

    it('should return error when cifnif is missing', async () => {
      const result = await createProveedorImplementation({ nombre: 'Test' }, mockClient);
      const response = JSON.parse(result.content[0].text);

      expect(result.isError).toBe(true);
      expect(response.message).toContain('CIF/NIF');
    });

    it('should return error when cifnif is empty/whitespace', async () => {
      const result = await createProveedorImplementation({ nombre: 'Test', cifnif: '  ' }, mockClient);

      expect(result.isError).toBe(true);
    });
  });

  describe('success without address', () => {
    it('should create supplier with required fields only', async () => {
      const apiResponse = { codproveedor: 'PROV001', nombre: 'Test', cifnif: 'B12345' };
      mockClient.post.mockResolvedValue(apiResponse);

      const result = await createProveedorImplementation(
        { nombre: 'Test', cifnif: 'B12345' },
        mockClient
      );
      const response = JSON.parse(result.content[0].text);

      expect(result.isError).toBeUndefined();
      expect(response.success).toBe(true);
      expect(response.message).toContain('Test');
      expect(mockClient.post).toHaveBeenCalledWith('/proveedores', {
        nombre: 'Test',
        cifnif: 'B12345',
        razonsocial: 'Test',
      });
      expect(mockClient.put).not.toHaveBeenCalled();
    });

    it('should use razonsocial if provided', async () => {
      mockClient.post.mockResolvedValue({ codproveedor: 'PROV001', nombre: 'Test' });

      await createProveedorImplementation(
        { nombre: 'Test', cifnif: 'B12345', razonsocial: 'Razon Social S.L.' },
        mockClient
      );

      const sentData = mockClient.post.mock.calls[0][1];
      expect(sentData.razonsocial).toBe('Razon Social S.L.');
    });

    it('should fall back razonsocial to nombre when not provided', async () => {
      mockClient.post.mockResolvedValue({ codproveedor: 'PROV001', nombre: 'Test' });

      await createProveedorImplementation(
        { nombre: 'Test', cifnif: 'B12345' },
        mockClient
      );

      const sentData = mockClient.post.mock.calls[0][1];
      expect(sentData.razonsocial).toBe('Test');
    });

    it('should include all optional contact fields', async () => {
      mockClient.post.mockResolvedValue({ codproveedor: 'PROV001', nombre: 'Test' });

      await createProveedorImplementation({
        nombre: 'Test',
        cifnif: 'B12345',
        email: 'test@example.com',
        telefono1: '600111222',
        telefono2: '600333444',
        web: 'https://example.com',
        codpago: 'TRANS',
        observaciones: 'Notes',
        tipoidfiscal: 'CIF',
        regimeniva: 'General',
      }, mockClient);

      const sentData = mockClient.post.mock.calls[0][1];
      expect(sentData.email).toBe('test@example.com');
      expect(sentData.telefono1).toBe('600111222');
      expect(sentData.telefono2).toBe('600333444');
      expect(sentData.web).toBe('https://example.com');
      expect(sentData.codpago).toBe('TRANS');
      expect(sentData.observaciones).toBe('Notes');
      expect(sentData.tipoidfiscal).toBe('CIF');
      expect(sentData.regimeniva).toBe('General');
    });
  });

  describe('success with address (PUT contact flow)', () => {
    it('should update contact address when idcontacto is present', async () => {
      mockClient.post.mockResolvedValue({
        codproveedor: 'PROV001',
        nombre: 'Test',
        cifnif: 'B12345',
        idcontacto: 42,
      });
      mockClient.put.mockResolvedValue({ idcontacto: 42, direccion: 'Calle Test 1' });

      const result = await createProveedorImplementation({
        nombre: 'Test',
        cifnif: 'B12345',
        direccion: 'Calle Test 1',
        codpostal: '28001',
        ciudad: 'Madrid',
      }, mockClient);
      const response = JSON.parse(result.content[0].text);

      expect(mockClient.put).toHaveBeenCalledWith('/contactos/42', {
        direccion: 'Calle Test 1',
        codpostal: '28001',
        ciudad: 'Madrid',
      });
      expect(response.contacto.success).toBe(true);
      expect(response.contacto.idcontacto).toBe(42);
    });

    it('should handle missing idcontacto in response', async () => {
      mockClient.post.mockResolvedValue({
        codproveedor: 'PROV001',
        nombre: 'Test',
        cifnif: 'B12345',
      });

      const result = await createProveedorImplementation({
        nombre: 'Test',
        cifnif: 'B12345',
        direccion: 'Calle Test 1',
      }, mockClient);
      const response = JSON.parse(result.content[0].text);

      expect(response.success).toBe(true);
      expect(response.contacto.warning).toContain('idcontacto');
      expect(mockClient.put).not.toHaveBeenCalled();
    });

    it('should handle contact update failure gracefully', async () => {
      mockClient.post.mockResolvedValue({
        codproveedor: 'PROV001',
        nombre: 'Test',
        cifnif: 'B12345',
        idcontacto: 42,
      });
      mockClient.put.mockRejectedValue(new Error('Contact update failed'));

      const result = await createProveedorImplementation({
        nombre: 'Test',
        cifnif: 'B12345',
        direccion: 'Calle Test 1',
      }, mockClient);
      const response = JSON.parse(result.content[0].text);

      expect(response.success).toBe(true);
      expect(response.contacto.warning).toContain('Contact update failed');
      expect(response.contacto.idcontacto).toBe(42);
    });

    it('should not call PUT when no address fields are provided', async () => {
      mockClient.post.mockResolvedValue({
        codproveedor: 'PROV001',
        nombre: 'Test',
        cifnif: 'B12345',
        idcontacto: 42,
      });

      const result = await createProveedorImplementation(
        { nombre: 'Test', cifnif: 'B12345' },
        mockClient
      );
      const response = JSON.parse(result.content[0].text);

      expect(mockClient.put).not.toHaveBeenCalled();
      expect(response.contacto).toBeUndefined();
    });
  });

  describe('error handling', () => {
    it('should handle API errors during supplier creation', async () => {
      mockClient.post.mockRejectedValue(new Error('API connection failed'));

      const result = await createProveedorImplementation(
        { nombre: 'Test', cifnif: 'B12345' },
        mockClient
      );
      const response = JSON.parse(result.content[0].text);

      expect(result.isError).toBe(true);
      expect(response.error).toBe('Error al crear proveedor');
      expect(response.message).toBe('API connection failed');
    });

    it('should include API response details in error', async () => {
      const axiosError: any = new Error('Bad Request');
      axiosError.response = { data: { code: 400, message: 'Duplicate CIF/NIF' } };
      mockClient.post.mockRejectedValue(axiosError);

      const result = await createProveedorImplementation(
        { nombre: 'Test', cifnif: 'B12345' },
        mockClient
      );
      const response = JSON.parse(result.content[0].text);

      expect(response.details).toEqual({ code: 400, message: 'Duplicate CIF/NIF' });
    });
  });
});