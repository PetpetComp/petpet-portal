import { MASTER_SERVICES, type MasterRow } from "./master";
import { collectRows } from "./common";
export type RegionRow = MasterRow;
export const REGION_SERVICES = {
  countries: () => collectRows(MASTER_SERVICES.countries),
  provinces: (countryId: string) =>
    collectRows((params) =>
      MASTER_SERVICES.provinces({ ...params, country_id: countryId }),
    ),
  cities: (provinceId: string) =>
    collectRows((params) =>
      MASTER_SERVICES.cities({ ...params, province_id: provinceId }),
    ),
  districts: (cityId: string) =>
    collectRows((params) =>
      MASTER_SERVICES.districts({ ...params, city_id: cityId }),
    ),
};
