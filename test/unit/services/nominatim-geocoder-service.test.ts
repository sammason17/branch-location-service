import { NominatimGeocoderService } from '../../../src/services/nominatim-geocoder-service';

describe('NominatimGeocoderService', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('geocodes location successfully with state param', async () => {
    const mockApiResponse = [
      {
        lat: '54.7761',
        lon: '-1.5733',
        display_name: 'Durham, County Durham, UK',
      },
    ];

    const fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => mockApiResponse,
    } as Response);

    const service = new NominatimGeocoderService();
    const result = await service.geocode('Durham', 'UK', 'County Durham');

    expect(result).toEqual({
      latitude: 54.7761,
      longitude: -1.5733,
    });

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const calledUrl = fetchSpy.mock.calls[0][0] as string;
    expect(calledUrl).toContain('city=Durham');
    expect(calledUrl).toContain('country=UK');
    expect(calledUrl).toContain('state=County+Durham');
    expect(calledUrl).toContain('format=json');
  });

  it('geocodes location successfully without state', async () => {
    const mockApiResponse = [
      {
        lat: '32.7762719',
        lon: '-96.7968559',
        display_name: 'Dallas, Texas, United States',
      },
    ];

    const fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => mockApiResponse,
    } as Response);

    const service = new NominatimGeocoderService();
    const result = await service.geocode('Dallas', 'United States');

    expect(result).toEqual({
      latitude: 32.7762719,
      longitude: -96.7968559,
    });

    const calledUrl = fetchSpy.mock.calls[0][0] as string;
    expect(calledUrl).not.toContain('state=');
  });

  it('throws an error if response status is not ok', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: false,
      status: 503,
    } as Response);

    const service = new NominatimGeocoderService();

    await expect(service.geocode('Durham', 'UK')).rejects.toThrow(
      'Geocoding request failed with status 503'
    );
  });

  it('throws an error if empty results array is returned', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => [],
    } as Response);

    const service = new NominatimGeocoderService();

    await expect(service.geocode('Durham', 'UK')).rejects.toThrow(
      'Unable to geocode location: Durham, UK'
    );
  });
});
