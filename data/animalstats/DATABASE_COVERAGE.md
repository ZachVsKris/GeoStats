# Bulk animal trait coverage

Research catalogs are not approved game observations. No imported row enters daily rotation automatically.

| Database | Records | Status |
|---|---:|---|
| sealifebase | 49,848 | Length types are kept separately. Depth ranges are habitat limits, not measured dive performance. |
| animaltraits | 3,580 | Repeated studies are separate observations; converted brain volume is not a directly weighed brain. |
| insect-bite | 654 | Bite series are not independent specimens. Body and head dimensions are one anatomy family. |
| biotic | 685 | Preserve categorical traits as categories; never turn a size or lifespan bucket into a measured value. |
| globtherm | 2,133 | CTmax, LT50, LT100 and thermoneutral limits are different traits. Celsius needs an absolute separation threshold. |

## Numeric coverage

### sealifebase

| Field | Nonempty finite values |
|---|---:|
| CommonLength | 365 |
| DepthRangeDeep | 14,416 |
| DepthRangeShallow | 14,739 |
| Length | 6,262 |
| LengthFemale | 507 |
| LongevityCaptive | 1 |
| LongevityWild | 190 |
| Weight | 513 |
| WeightFemale | 51 |

### animaltraits

| Field | Nonempty finite values |
|---|---:|
| body mass | 2,856 |
| brain size | 2,361 |
| metabolic rate | 1,185 |

### insect-bite

| Field | Nonempty finite values |
|---|---:|
| mean.ID.body.l.geom | 654 |
| mean.ID.head.w.geom | 654 |
| mean.ID.wing.l.geom | 654 |
| mean.bf.ID.geom | 654 |

### biotic

| Field | Nonempty finite values |
|---|---:|

### globtherm

| Field | Nonempty finite values |
|---|---:|
| lowerTemperature | 1,355 |
| upperTemperature | 1,631 |

