//components/entity/document/DocumentGrid.tsx

import {
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Typography,
  Box,
  Button,
  Tooltip,
  alpha,
} from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import DescriptionOutlinedIcon from "@mui/icons-material/DescriptionOutlined";
import VisibilityOutlinedIcon from "@mui/icons-material/VisibilityOutlined";
import type { ProjectDocument_Input as ProjectDocument } from "@/api/models/ProjectDocument_Input";

interface DocumentGridProps {
  rows: ProjectDocument[];
  onRowClick?: (id: string) => void;
  onDelete?: (id: string, row: ProjectDocument) => void;
  loading?: boolean;
  hasMore?: boolean;
  lastElementRef?: React.RefObject<HTMLDivElement | null>;
}

function EmbeddingHeatmap({ embedding }: { embedding: number[] | null | undefined }) {
  if (!embedding || embedding.length === 0) {
    return null;
  }

  const maxSegments = 50;
  const step = Math.max(1, Math.floor(embedding.length / maxSegments));
  const sampledValues = embedding.filter((_, i) => i % step === 0);

  return (
    <Tooltip
      title={
        <Box>
          <Typography variant="caption" sx={{ fontWeight: 600, display: 'block', mb: 0.5 }}>
            Semantic Vector
          </Typography>
          <Typography variant="caption" sx={{ opacity: 0.8 }}>
            {embedding.length} dimensions
          </Typography>
        </Box>
      }
      arrow
      placement="top"
    >
      <Box
        sx={{
          display: "flex",
          height: "7px",
          width: "120px",
          border: (theme) => `1px solid ${alpha(theme.palette.divider, 0.1)}`,
          borderRadius: "4px",
          overflow: "hidden",
          boxShadow: (theme) => `0 1px 4px ${alpha(theme.palette.primary.main, 0.08)}`,
          transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
          "&:hover": {
            transform: "scale(1.02)",
            boxShadow: (theme) => `0 2px 6px ${alpha(theme.palette.primary.main, 0.15)}`,
          },
        }}
      >
        {sampledValues.map((value, index) => {
          const clampedValue = Math.max(-0.15, Math.min(0.15, value));
          const normalized = (clampedValue + 0.15) / 0.3;

          // Blue-based color scheme with high contrast and vivid colors
          let hue: number;
          let saturation: number;
          let lightness: number;

          if (normalized < 0.5) {
            // Negative values: bright cyan to azure (180 to 210)
            hue = 180 + (0.5 - normalized) * 60;
            saturation = 85 + (0.5 - normalized) * 10;
            lightness = 35 + (0.5 - normalized) * 30;
          } else {
            // Positive values: electric blue to deep indigo (210 to 260)
            hue = 210 + (normalized - 0.5) * 100;
            saturation = 90 - (normalized - 0.5) * 15;
            lightness = 55 - (normalized - 0.5) * 30;
          }

          const color = `hsl(${hue}, ${saturation}%, ${lightness}%)`;

          return (
            <Box
              key={index}
              sx={{
                flex: 1,
                backgroundColor: color,
                minWidth: "2px",
                transition: "opacity 0.2s",
                "&:hover": {
                  opacity: 0.8,
                },
              }}
            />
          );
        })}
      </Box>
    </Tooltip>
  );
}

export default function DocumentGrid({
  rows,
  onRowClick,
  loading,
  hasMore,
  lastElementRef,
}: DocumentGridProps) {
  return (
    <Box sx={{ width: "100%", display: "flex", flexDirection: "column", gap: 2 }}>
      {rows.map((doc, index) => {
        const isLastElement = index === rows.length - 1;
        return (
        <Box
          key={doc._id || doc.code}
          ref={isLastElement && hasMore ? lastElementRef : null}
        >
        <Accordion
          elevation={0}
          sx={{
            border: (theme) => `1px solid ${alpha(theme.palette.divider, 0.08)}`,
            borderRadius: "12px !important",
            overflow: "hidden",
            transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
            background: (theme) =>
              `linear-gradient(135deg, ${alpha(theme.palette.background.paper, 1)} 0%, ${alpha(
                theme.palette.background.paper,
                0.98
              )} 100%)`,
            "&:before": {
              display: "none",
            },
            "&:hover": {
              boxShadow: (theme) =>
                `0 8px 24px ${alpha(theme.palette.primary.main, 0.12)}`,
              transform: "translateY(-2px)",
              borderColor: (theme) => alpha(theme.palette.primary.main, 0.2),
            },
            "&.Mui-expanded": {
              margin: "0 !important",
              boxShadow: (theme) =>
                `0 12px 32px ${alpha(theme.palette.primary.main, 0.15)}`,
            },
          }}
        >
          <AccordionSummary
            expandIcon={
              <ExpandMoreIcon
                sx={{
                  color: "primary.main",
                  transition: "transform 0.3s",
                }}
              />
            }
            aria-controls={`panel-${doc._id}-content`}
            id={`panel-${doc._id}-header`}
            sx={{
              padding: "16px 24px",
              "& .MuiAccordionSummary-content": {
                margin: "12px 0",
                display: "flex",
                alignItems: "center",
                gap: 2,
              },
              "&:hover": {
                backgroundColor: (theme) => alpha(theme.palette.primary.main, 0.02),
              },
            }}
          >
            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                width: 40,
                height: 40,
                borderRadius: "10px",
                background: (theme) =>
                  `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.1)} 0%, ${alpha(
                    theme.palette.primary.light,
                    0.15
                  )} 100%)`,
                flexShrink: 0,
              }}
            >
              <DescriptionOutlinedIcon
                sx={{
                  color: "primary.main",
                  fontSize: 22,
                }}
              />
            </Box>
            <Box sx={{ flex: 1, minWidth: 0, overflow: "hidden" }}>
              <Typography
                sx={{
                  fontWeight: 600,
                  fontSize: "1rem",
                  color: "text.primary",
                  mb: 0.5,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {doc.name}
              </Typography>
              <Box
                sx={{
                  overflow: "hidden",
                  transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
                  ".Mui-expanded &": {
                    maxHeight: 0,
                    opacity: 0,
                    marginTop: 0,
                  },
                  maxHeight: "40px",
                  opacity: 1,
                }}
              >
                <Typography
                  variant="body2"
                  sx={{
                    color: "text.secondary",
                    fontSize: "0.875rem",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    display: "-webkit-box",
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: "vertical",
                    opacity: 0.7,
                    lineHeight: 1.4,
                  }}
                >
                  {doc.content || ""}
                </Typography>
              </Box>
            </Box>
          </AccordionSummary>
          <AccordionDetails
            sx={{
              padding: "0 24px 24px 24px",
              backgroundColor: (theme) => alpha(theme.palette.background.default, 0.3),
            }}
          >
            <Box
              sx={{
                backgroundColor: "background.paper",
                borderRadius: "8px",
                padding: 3,
                border: (theme) => `1px solid ${alpha(theme.palette.divider, 0.05)}`,
              }}
            >
              <Typography
                sx={{
                  whiteSpace: "pre-wrap",
                  mb: 3,
                  lineHeight: 1.7,
                  color: "text.primary",
                  fontSize: "0.95rem",
                }}
              >
                {doc.content}
              </Typography>
              <Box
                sx={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 2,
                  pt: 2,
                  borderTop: (theme) => `1px solid ${alpha(theme.palette.divider, 0.08)}`,
                }}
              >
                {onRowClick && doc._id && (
                  <Button
                    variant="contained"
                    startIcon={<VisibilityOutlinedIcon />}
                    onClick={() => onRowClick(doc._id!)}
                    sx={{
                      textTransform: "none",
                      borderRadius: "8px",
                      paddingX: 3,
                      paddingY: 1,
                      fontWeight: 600,
                      boxShadow: (theme) => `0 4px 12px ${alpha(theme.palette.primary.main, 0.2)}`,
                      transition: "all 0.2s",
                      "&:hover": {
                        boxShadow: (theme) => `0 6px 16px ${alpha(theme.palette.primary.main, 0.3)}`,
                        transform: "translateY(-1px)",
                      },
                    }}
                  >
                    View Details
                  </Button>
                )}
                <Box sx={{ marginLeft: "auto" }}>
                  <EmbeddingHeatmap embedding={doc.content_embedding} />
                </Box>
              </Box>
            </Box>
          </AccordionDetails>
        </Accordion>
        </Box>
        );
      })}

      {loading && (
        <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
          <Typography variant="body2" sx={{ color: "text.secondary" }}>
            Loading more documents...
          </Typography>
        </Box>
      )}

      {!loading && !hasMore && rows.length > 0 && (
        <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
          <Typography variant="body2" sx={{ color: "text.secondary", opacity: 0.6 }}>
            No more documents to load
          </Typography>
        </Box>
      )}
    </Box>
  );
}
