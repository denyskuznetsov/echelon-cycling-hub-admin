import path from "path";
import React from "react";
import {
  Document,
  Page,
  View,
  Text,
  Image,
  StyleSheet,
} from "@react-pdf/renderer";
import type {
  BikeFitReportData,
  BikeFitReportPositionRow,
  BikeFitReportRow,
  BikeFitReportSection,
} from "@/src/lib/bike-fit-report-data";

/**
 * Static report assets (logo, measurement diagrams) live in `public/`. This
 * document is only ever rendered server-side (via renderToBuffer), so @react-pdf
 * loads them straight off disk by absolute path.
 */
const PUBLIC_DIR = path.join(process.cwd(), "public");

function publicAssetPath(filename: string): string {
  return path.join(PUBLIC_DIR, filename);
}

const COLORS = {
  heading: "#1b2a4a",
  accent: "#f5921f",
  label: "#8a93a6",
  value: "#1f2733",
  border: "#d8dce4",
  placeholder: "#e6e8ee",
  placeholderText: "#9aa2b1",
} as const;

const styles = StyleSheet.create({
  page: {
    paddingVertical: 40,
    paddingHorizontal: 48,
    fontSize: 10,
    fontFamily: "Helvetica",
    color: COLORS.value,
    lineHeight: 1.4,
  },
  logo: {
    alignSelf: "center",
    width: 240,
    height: 56,
    marginBottom: 24,
    objectFit: "contain",
  },
  placeholderText: {
    fontSize: 9,
    color: COLORS.placeholderText,
  },
  categoryTitle: {
    fontSize: 17,
    fontFamily: "Helvetica-Bold",
    color: COLORS.heading,
    marginTop: 20,
    marginBottom: 6,
  },
  subSectionTitle: {
    fontSize: 11,
    fontFamily: "Helvetica-Bold",
    color: COLORS.heading,
    marginTop: 10,
    marginBottom: 4,
  },
  fieldRow: {
    flexDirection: "row",
    marginBottom: 2,
  },
  fieldLabel: {
    width: "45%",
    color: COLORS.label,
  },
  fieldValue: {
    width: "55%",
    fontFamily: "Helvetica-Bold",
    color: COLORS.value,
  },
  riderRow: {
    flexDirection: "row",
    marginBottom: 3,
  },
  riderLabel: {
    color: COLORS.label,
  },
  riderValue: {
    fontFamily: "Helvetica-Bold",
    color: COLORS.value,
  },
  riderFields: {
    marginTop: 6,
  },
  table: {
    marginTop: 6,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderBottomWidth: 0,
  },
  tableRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderColor: COLORS.border,
  },
  tableLabelCell: {
    width: "32%",
    paddingVertical: 14,
    paddingHorizontal: 10,
    justifyContent: "center",
    color: COLORS.label,
  },
  tableDiagramCell: {
    width: "38%",
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: COLORS.border,
    alignItems: "center",
    justifyContent: "center",
  },
  diagramImage: {
    width: "100%",
    height: 64,
    objectFit: "contain",
  },
  tableValueCell: {
    width: "30%",
    paddingVertical: 14,
    paddingHorizontal: 10,
    alignItems: "center",
    justifyContent: "center",
    fontFamily: "Helvetica-Bold",
  },
  fitterName: {
    fontFamily: "Helvetica-Bold",
    marginBottom: 2,
  },
  fitterEmail: {
    color: COLORS.accent,
  },
  photosRow: {
    flexDirection: "row",
    gap: 16,
    marginTop: 10,
  },
  photoBox: {
    flex: 1,
  },
  photoCaption: {
    fontSize: 9,
    color: COLORS.label,
    marginBottom: 4,
  },
  photoImage: {
    width: "100%",
    height: 200,
    objectFit: "contain",
    borderRadius: 4,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  photoPlaceholder: {
    width: "100%",
    height: 200,
    borderRadius: 4,
    backgroundColor: COLORS.placeholder,
    alignItems: "center",
    justifyContent: "center",
  },
});

function RiderField({ label, value }: BikeFitReportRow) {
  return (
    <View style={styles.riderRow}>
      <Text style={styles.riderLabel}>{label}: </Text>
      <Text style={styles.riderValue}>{value}</Text>
    </View>
  );
}

function ReportSection({ section }: { section: BikeFitReportSection }) {
  return (
    <View wrap={false}>
      <Text style={styles.subSectionTitle}>{section.title}</Text>
      {section.fields.map((field) => (
        <View key={field.label} style={styles.fieldRow}>
          <Text style={styles.fieldLabel}>{field.label}</Text>
          <Text style={styles.fieldValue}>{field.value}</Text>
        </View>
      ))}
    </View>
  );
}

function ReportCategory({
  title,
  sections,
}: {
  title: string;
  sections: BikeFitReportSection[];
}) {
  if (sections.length === 0) return null;
  return (
    <View>
      <Text style={styles.categoryTitle}>{title}</Text>
      {sections.map((section) => (
        <ReportSection key={section.title} section={section} />
      ))}
    </View>
  );
}

function MeasurementTable({ rows }: { rows: BikeFitReportPositionRow[] }) {
  return (
    <View style={styles.table}>
      {rows.map((row) => (
        <View key={row.label} style={styles.tableRow} wrap={false}>
          <Text style={styles.tableLabelCell}>{row.label}:</Text>
          <View style={styles.tableDiagramCell}>
            {/* eslint-disable-next-line jsx-a11y/alt-text -- @react-pdf Image has no alt prop */}
            <Image style={styles.diagramImage} src={publicAssetPath(row.diagram)} />
          </View>
          <Text style={styles.tableValueCell}>{row.value}</Text>
        </View>
      ))}
    </View>
  );
}

interface PhotoSlotProps {
  caption: string;
  url: string | null;
}

function PhotoSlot({ caption, url }: PhotoSlotProps) {
  return (
    <View style={styles.photoBox}>
      <Text style={styles.photoCaption}>{caption}</Text>
      {url ? (
        // eslint-disable-next-line jsx-a11y/alt-text -- @react-pdf Image has no alt prop
        <Image style={styles.photoImage} src={url} />
      ) : (
        <View style={styles.photoPlaceholder}>
          <Text style={styles.placeholderText}>No photo</Text>
        </View>
      )}
    </View>
  );
}

export function BikeFitReportDocument({ data }: { data: BikeFitReportData }) {
  return (
    <Document title="Bike Fit Report">
      <Page size="A4" style={styles.page}>
        {/* eslint-disable-next-line jsx-a11y/alt-text -- @react-pdf Image has no alt prop */}
        <Image
          style={styles.logo}
          src={publicAssetPath("echeloncycling_full_logo.jpg")}
        />

        <Text style={styles.categoryTitle}>Rider</Text>
        <View style={styles.riderFields}>
          <RiderField label="Name" value={data.rider.name} />
          <RiderField label="Email" value={data.rider.email} />
          <RiderField label="Sex" value={data.rider.sex} />
          <RiderField label="Phone" value={data.rider.phone} />
        </View>

        <ReportCategory title="Old Bike" sections={data.oldBikeSections} />

        <ReportCategory
          title="Physical Assessment"
          sections={data.physicalAssessmentSections}
        />

        <Text style={styles.categoryTitle}>New Bike Fit</Text>
        <Text style={styles.subSectionTitle}>Fit position</Text>
        <MeasurementTable rows={data.newFitPositionRows} />
        {data.newBikeSections.map((section) => (
          <ReportSection key={section.title} section={section} />
        ))}

        <Text style={styles.categoryTitle}>Fitter</Text>
        <Text style={styles.fitterName}>{data.fitter.name}</Text>
        <Text style={styles.fitterEmail}>{data.fitter.email}</Text>

        <Text style={styles.categoryTitle}>Date</Text>
        <Text>{data.date}</Text>

        <Text style={styles.categoryTitle}>Reference Photos</Text>
        <View style={styles.photosRow} wrap={false}>
          <PhotoSlot caption="Front view" url={data.photoFrontUrl} />
          <PhotoSlot caption="Side view" url={data.photoSideUrl} />
        </View>
      </Page>
    </Document>
  );
}
