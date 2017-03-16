# Overview

STEP is a work in progress medical image computing project.

The goal is to implement GPU accelerated volume calculations using
JavaScript and WebGL 2.0.  Everything should run in the browser
with only data access coming from external servers.

Internal data structures should be as close as possible
to native DICOM representations.

# Conventions

## Spaces

Coordinates and matrices are defined with respect to reference coordinates
with these names:

**Patient or LPS** is world space in millimeters with respect to the subject (patient)
in LPS convention (left, posterior, superior) as defined in DICOM and
[Slicer](https://www.slicer.org/wiki/Coordinate_systems).

**Pixel or IJK** is index space of the array.  Layout in memory is as
defined by the DICOM multiframe dataset values, but is for now
implemented as pixel = volume[k][j][i] or pixel = volume[slice][row][column] where
slice goes from 0 to dataset.NumberOfFrames-1,
row goes from 0 to dataset.Rows-1, and
column goes from 0 to dataset.Columns-1.  The elements of
a pixel coordinate are stored in column, row, slice order
for consistency with stp space order.

**Texture or stp** is coordinate access when the volume is loaded
in a WebGL 3D texture.  Here the coordinates are 0 to 1 with
sample.s selecting the column, sample.t selecting the row, and
sample.p selecting the slice (reverse order of Pixel space).

## Naming

Values that map from one space to another are named to indicate
the direction of mapping.  E.g. patientToPixel is a 4x4 matrix
that maps from LPS space to slice,row,colum space and textureToPixel
is a vec3 that goes from stp space to slice,row,colum.
