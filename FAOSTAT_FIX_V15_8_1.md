# GeoStats v15.8.1 FAOSTAT livestock correction

The v15.8.0 policy recognized English units such as `Head` but did not recognize FAOSTAT QCL's official animal-count abbreviation `An`. As a result, valid `Stocks` categories such as **Largest horse population** remained rejected after the v15.7 blanket policy.

This correction:

- treats QCL element `5111` (`Stocks`) as a live-animal population total;
- recognizes `An` as animals in the importer;
- keeps yield, harvested area, slaughter, carcass, per-animal and productivity measures blocked;
- restores nine individual-species population categories when their integrity gates pass;
- holds the two overlapping combined aggregates for manual review;
- displays the unit as `animals` while retaining `An` as the official source unit; and
- adds regression coverage for a real `Stocks` + `An` row.
