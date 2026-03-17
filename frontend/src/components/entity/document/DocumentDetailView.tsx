//components/entity/document/DocumentDetailView.tsx

import React from "react";
import {
  Box,
  Typography,
  Button,
  Tooltip,
  alpha,
} from "@mui/material";
import DescriptionOutlinedIcon from "@mui/icons-material/DescriptionOutlined";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import type { ProjectDocument_Input as ProjectDocument } from "@/api/models/ProjectDocument_Input";

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

          let hue: number;
          let saturation: number;
          let lightness: number;

          if (normalized < 0.5) {
            hue = 180 + (0.5 - normalized) * 60;
            saturation = 85 + (0.5 - normalized) * 10;
            lightness = 35 + (0.5 - normalized) * 30;
          } else {
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

interface DocumentDetailViewProps {
  item: ProjectDocument;
  onEdit: () => void;
  detailExtras?: (item: ProjectDocument) => React.ReactNode;
}

export default function DocumentDetailView({
  item,
  onEdit,
  detailExtras,
}: DocumentDetailViewProps) {
  return (
    <Box
      sx={{
        border: (theme) => `1px solid ${alpha(theme.palette.divider, 0.08)}`,
        borderRadius: "12px",
        overflow: "hidden",
        background: (theme) =>
          `linear-gradient(135deg, ${alpha(theme.palette.background.paper, 1)} 0%, ${alpha(
            theme.palette.background.paper,
            0.98
          )} 100%)`,
        boxShadow: (theme) => `0 8px 24px ${alpha(theme.palette.primary.main, 0.08)}`,
      }}
    >
      {/* Header */}
      <Box
        sx={{
          padding: "20px 24px",
          display: "flex",
          alignItems: "center",
          gap: 2,
          borderBottom: (theme) => `1px solid ${alpha(theme.palette.divider, 0.06)}`,
        }}
      >
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: 48,
            height: 48,
            borderRadius: "12px",
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
              fontSize: 26,
            }}
          />
        </Box>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography
            sx={{
              fontWeight: 600,
              fontSize: "1.25rem",
              color: "text.primary",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {item.name}
          </Typography>
          <Typography
            variant="body2"
            sx={{
              color: "text.secondary",
              fontSize: "0.875rem",
              opacity: 0.7,
            }}
          >
            {item.code}
          </Typography>
        </Box>
        <Button
          variant="outlined"
          startIcon={<EditOutlinedIcon />}
          onClick={onEdit}
          sx={{
            textTransform: "none",
            borderRadius: "8px",
            paddingX: 2.5,
            paddingY: 1,
            fontWeight: 600,
            borderColor: (theme) => alpha(theme.palette.primary.main, 0.3),
            color: "primary.main",
            transition: "all 0.2s",
            "&:hover": {
              borderColor: "primary.main",
              backgroundColor: (theme) => alpha(theme.palette.primary.main, 0.04),
            },
          }}
        >
          Edit
        </Button>
      </Box>

      {/* Content */}
      <Box
        sx={{
          padding: "24px",
          backgroundColor: (theme) => alpha(theme.palette.background.default, 0.3),
        }}
      >
        {/* Description */}
        {item.description && (
          <Box sx={{ mb: 3 }}>
            <Typography
              variant="caption"
              sx={{
                color: "text.secondary",
                fontSize: "0.75rem",
                fontWeight: 500,
                textTransform: "uppercase",
                letterSpacing: "0.05em",
                display: "block",
                mb: 1,
              }}
            >
              Description
            </Typography>
            <Typography
              sx={{
                color: "text.primary",
                fontSize: "0.95rem",
                lineHeight: 1.6,
              }}
            >
              {item.description}
            </Typography>
          </Box>
        )}

        {/* Content Section */}
        <Box
          sx={{
            backgroundColor: "background.paper",
            borderRadius: "8px",
            padding: 3,
            border: (theme) => `1px solid ${alpha(theme.palette.divider, 0.05)}`,
          }}
        >
          <Typography
            variant="caption"
            sx={{
              color: "text.secondary",
              fontSize: "0.75rem",
              fontWeight: 500,
              textTransform: "uppercase",
              letterSpacing: "0.05em",
              display: "block",
              mb: 1.5,
            }}
          >
            Content
          </Typography>
          <Typography
            sx={{
              whiteSpace: "pre-wrap",
              lineHeight: 1.7,
              color: "text.primary",
              fontSize: "0.95rem",
            }}
          >
            {item.content || "No content"}
          </Typography>
        </Box>

        {/* Footer with embedding */}
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "flex-end",
            gap: 2,
            pt: 3,
            mt: 3,
            borderTop: (theme) => `1px solid ${alpha(theme.palette.divider, 0.08)}`,
          }}
        >
          <EmbeddingHeatmap embedding={item.content_embedding} />
        </Box>

        {/* Detail extras */}
        {detailExtras && detailExtras(item)}
      </Box>
    </Box>
  );
}
