import { describe, it, expect, vi, beforeEach } from 'vitest';
import axios from 'axios';
import { FacturaScriptsClient } from '../../../src/fs/client.js';

vi.mock('axios');
vi.mock('../../../src/env.js', () => ({
  env: {
    FS_BASE_URL: 'https://test.facturascripts.com',
    FS_API_VERSION: '3',
    FS_API_TOKEN: 'test-token'
  }
}));

const mockedAxios = vi.mocked(axios);

describe('FacturaScriptsClient', () => {
  let client: FacturaScriptsClient;
  let mockAxiosInstance: any;

  beforeEach(() => {
    mockAxiosInstance = {
      get: vi.fn(),
      post: vi.fn(),
      put: vi.fn(),
      delete: vi.fn(),
    };

    mockedAxios.create.mockReturnValue(mockAxiosInstance);
    client = new FacturaScriptsClient();
  });

  describe('constructor', () => {
    it('should create axios instance with correct config', () => {
      expect(mockedAxios.create).toHaveBeenCalledWith({
        baseURL: 'https://test.facturascripts.com/api/3',
        headers: {
          'token': 'test-token',
          'Content-Type': 'application/json',
        },
      });
    });
  });

  describe('get', () => {
    it('should make GET request and return data', async () => {
      const mockData = { test: 'data' };
      mockAxiosInstance.get.mockResolvedValue({ data: mockData });

      const result = await client.get('/test-endpoint');

      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/test-endpoint', { params: undefined });
      expect(result).toEqual(mockData);
    });

    it('should pass params to axios', async () => {
      const mockData = { test: 'data' };
      const params = { limit: 10, offset: 0 };
      mockAxiosInstance.get.mockResolvedValue({ data: mockData });

      await client.get('/test-endpoint', params);

      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/test-endpoint', { params });
    });
  });

  describe('getWithPagination', () => {
    it('should return paginated response with meta information', async () => {
      const mockData = [
        { id: 1, name: 'Test 1' },
        { id: 2, name: 'Test 2' }
      ];
      mockAxiosInstance.get.mockResolvedValue({ 
        data: mockData,
        headers: {}
      });

      const result = await client.getWithPagination('/test-endpoint', 10, 0);

      expect(result).toEqual({
        meta: {
          total: 2,
          limit: 10,
          offset: 0,
          hasMore: false, // 2 < 10, so hasMore is false
        },
        data: mockData,
      });
    });

    it('should use default limit and offset', async () => {
      const mockData = [];
      mockAxiosInstance.get.mockResolvedValue({ 
        data: mockData,
        headers: {}
      });

      await client.getWithPagination('/test-endpoint');

      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/test-endpoint', {
        params: {
          limit: 50,
          offset: 0,
        },
      });
    });

    it('should handle additional params', async () => {
      const mockData = [];
      const additionalParams = { filter: 'active' };
      mockAxiosInstance.get.mockResolvedValue({ 
        data: mockData,
        headers: {}
      });

      await client.getWithPagination('/test-endpoint', 10, 0, additionalParams);

      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/test-endpoint', {
        params: {
          limit: 10,
          offset: 0,
          filter: 'active',
        },
      });
    });

    it('should calculate hasMore correctly with X-Total-Count header', async () => {
      const mockData = Array(50).fill(0).map((_, i) => ({ id: i }));
      mockAxiosInstance.get.mockResolvedValue({ 
        data: mockData,
        headers: {
          'x-total-count': '100'
        }
      });

      const result = await client.getWithPagination('/test-endpoint', 50, 0);

      expect(result.meta.hasMore).toBe(true);
      expect(result.meta.total).toBe(100);
    });

    it('should calculate hasMore correctly without X-Total-Count header', async () => {
      const mockData = Array(30).fill(0).map((_, i) => ({ id: i }));
      mockAxiosInstance.get.mockResolvedValue({ 
        data: mockData,
        headers: {}
      });

      const result = await client.getWithPagination('/test-endpoint', 50, 0);

      expect(result.meta.hasMore).toBe(false); // Less than limit, so no more data
      expect(result.meta.total).toBe(30);
    });

    it('should handle non-array response', async () => {
      mockAxiosInstance.get.mockResolvedValue({
        data: null,
        headers: {}
      });

      const result = await client.getWithPagination('/test-endpoint');

      expect(result.data).toEqual([]);
      expect(result.meta.total).toBe(0);
    });
  });

  describe('post', () => {
    it('should make POST request with form-urlencoded content type', async () => {
      const mockResponse = { idproducto: 1, referencia: 'REF001' };
      mockAxiosInstance.post.mockResolvedValue({ data: mockResponse });

      await client.post('/productos', { referencia: 'REF001', descripcion: 'Test' });

      expect(mockAxiosInstance.post).toHaveBeenCalledWith(
        '/productos',
        expect.any(String),
        { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
      );
    });

    it('should return response data', async () => {
      const mockResponse = { idproducto: 1, referencia: 'REF001' };
      mockAxiosInstance.post.mockResolvedValue({ data: mockResponse });

      const result = await client.post('/productos', { referencia: 'REF001' });

      expect(result).toEqual(mockResponse);
    });

    it('should serialize flat object to form-urlencoded string', async () => {
      mockAxiosInstance.post.mockResolvedValue({ data: {} });

      await client.post('/test', { nombre: 'Test', cifnif: 'B12345' });

      const sentBody = mockAxiosInstance.post.mock.calls[0][1];
      expect(sentBody).toContain('nombre=Test');
      expect(sentBody).toContain('cifnif=B12345');
    });

    it('should skip null and undefined values', async () => {
      mockAxiosInstance.post.mockResolvedValue({ data: {} });

      await client.post('/test', { a: 'ok', b: null, c: undefined });

      const sentBody = mockAxiosInstance.post.mock.calls[0][1];
      expect(sentBody).toContain('a=ok');
      expect(sentBody).not.toContain('b=');
      expect(sentBody).not.toContain('c=');
    });

    it('should serialize nested objects with bracket notation', async () => {
      mockAxiosInstance.post.mockResolvedValue({ data: {} });

      await client.post('/test', { address: { city: 'Madrid', zip: '28001' } });

      const sentBody = mockAxiosInstance.post.mock.calls[0][1];
      const params = new URLSearchParams(sentBody);
      expect(params.get('address[city]')).toBe('Madrid');
      expect(params.get('address[zip]')).toBe('28001');
    });

    it('should serialize arrays with index bracket notation', async () => {
      mockAxiosInstance.post.mockResolvedValue({ data: {} });

      await client.post('/test', { tags: ['a', 'b'] });

      const sentBody = mockAxiosInstance.post.mock.calls[0][1];
      const params = new URLSearchParams(sentBody);
      expect(params.get('tags[0]')).toBe('a');
      expect(params.get('tags[1]')).toBe('b');
    });

    it('should serialize arrays of objects with nested bracket notation', async () => {
      mockAxiosInstance.post.mockResolvedValue({ data: {} });

      await client.post('/test', { lineas: [{ desc: 'Item1', qty: 1 }] });

      const sentBody = mockAxiosInstance.post.mock.calls[0][1];
      const params = new URLSearchParams(sentBody);
      expect(params.get('lineas[0][desc]')).toBe('Item1');
      expect(params.get('lineas[0][qty]')).toBe('1');
    });

    it('should convert booleans and numbers to strings', async () => {
      mockAxiosInstance.post.mockResolvedValue({ data: {} });

      await client.post('/test', { active: true, count: 42 });

      const sentBody = mockAxiosInstance.post.mock.calls[0][1];
      expect(sentBody).toContain('active=true');
      expect(sentBody).toContain('count=42');
    });

    it('should propagate errors', async () => {
      mockAxiosInstance.post.mockRejectedValue(new Error('Network error'));

      await expect(client.post('/test', { a: 1 })).rejects.toThrow('Network error');
    });
  });

  describe('put', () => {
    it('should make PUT request with form-urlencoded content type', async () => {
      mockAxiosInstance.put.mockResolvedValue({ data: { updated: true } });

      await client.put('/contactos/42', { direccion: 'Calle Test 1' });

      expect(mockAxiosInstance.put).toHaveBeenCalledWith(
        '/contactos/42',
        expect.any(String),
        { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
      );
    });

    it('should return response data', async () => {
      const mockResponse = { idcontacto: 42, direccion: 'Calle Test 1' };
      mockAxiosInstance.put.mockResolvedValue({ data: mockResponse });

      const result = await client.put('/contactos/42', { direccion: 'Calle Test 1' });

      expect(result).toEqual(mockResponse);
    });

    it('should propagate errors', async () => {
      mockAxiosInstance.put.mockRejectedValue(new Error('Not found'));

      await expect(client.put('/contactos/999', { a: 1 })).rejects.toThrow('Not found');
    });
  });

  describe('delete', () => {
    it('should make DELETE request to the endpoint', async () => {
      mockAxiosInstance.delete.mockResolvedValue({ data: { success: true } });

      await client.delete('/proveedores/PROV001');

      expect(mockAxiosInstance.delete).toHaveBeenCalledWith('/proveedores/PROV001');
    });

    it('should return response data', async () => {
      const mockResponse = { success: true };
      mockAxiosInstance.delete.mockResolvedValue({ data: mockResponse });

      const result = await client.delete('/proveedores/PROV001');

      expect(result).toEqual(mockResponse);
    });

    it('should propagate errors', async () => {
      mockAxiosInstance.delete.mockRejectedValue(new Error('Forbidden'));

      await expect(client.delete('/proveedores/PROV001')).rejects.toThrow('Forbidden');
    });
  });
});