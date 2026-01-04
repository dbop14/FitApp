// Leaderboard Design System Configuration
// Extracted from leaderboard_design_system (1).json

export const leaderboardDesignSystem = {
  name: "Leaderboard UI Kit",
  version: "1.0.0",
  description: "Mobile-first leaderboard design system with dual theme support",
  
  colorPalette: {
    primary: {
      blue_50: "#eff6ff",
      blue_100: "#dbeafe",
      blue_200: "#bfdbfe",
      blue_300: "#93c5fd",
      blue_400: "#60a5fa",
      blue_500: "#3b82f6",
      blue_600: "#035FC3",
      blue_700: "#1d4ed8",
      blue_800: "#1e40af",
      blue_900: "#1e3a8a"
    },
    neutral: {
      white: "#ffffff",
      gray_50: "#f9fafb",
      gray_100: "#f3f4f6",
      gray_200: "#e5e7eb",
      gray_300: "#d1d5db",
      gray_400: "#9ca3af",
      gray_500: "#6b7280",
      gray_600: "#4b5563",
      gray_700: "#374151",
      gray_800: "#1f2937",
      gray_900: "#111827"
    },
    accent: {
      green: "#10b981",
      yellow: "#f59e0b",
      orange: "#f97316"
    }
  },

  themes: {
    light: {
      background: {
        primary: "#ffffff",
        secondary: "blue_50",
        card: "#ffffff",
        elevated: "blue_100"
      },
      text: {
        primary: "gray_900",
        secondary: "gray_600",
        muted: "gray_400"
      },
      border: "gray_200",
      shadow: "rgba(0, 0, 0, 0.05)"
    },
    dark: {
      background: {
        primary: "gray_900",
        secondary: "gray_800",
        card: "gray_800",
        elevated: "gray_700"
      },
      text: {
        primary: "#ffffff",
        secondary: "gray_300",
        muted: "gray_500"
      },
      border: "gray_700",
      shadow: "rgba(0, 0, 0, 0.25)"
    }
  },

  typography: {
    fontFamily: {
      primary: "system-ui, -apple-system, 'Segoe UI', sans-serif"
    },
    scale: {
      xs: "12px",
      sm: "14px",
      base: "16px",
      lg: "18px",
      xl: "20px",
      "2xl": "24px",
      "3xl": "30px",
      "4xl": "36px"
    },
    weight: {
      normal: 400,
      medium: 500,
      semibold: 600,
      bold: 700
    }
  },

  spacing: {
    xs: "4px",
    sm: "8px",
    md: "12px",
    lg: "16px",
    xl: "20px",
    "2xl": "24px",
    "3xl": "32px",
    "4xl": "48px"
  },

  borderRadius: {
    sm: "4px",
    md: "8px",
    lg: "12px",
    xl: "16px",
    "2xl": "20px",
    full: "9999px"
  },

  components: {
    leaderboardContainer: {
      structure: "Full-screen mobile container with header and scrollable content",
      padding: "lg",
      background: "theme.background.primary",
      minHeight: "100vh"
    },

    header: {
      structure: "Fixed header with centered title only",
      height: "56px",
      padding: "lg",
      background: "theme.background.primary",
      borderBottom: "1px solid theme.border",
      elements: {
        title: {
          fontSize: "xl",
          fontWeight: "semibold",
          color: "theme.text.primary",
          position: "center"
        }
      }
    },

    podium: {
      structure: "Top 3 competitors in elevated circular layout",
      layout: "flex with center alignment",
      spacing: "2xl",
      marginBottom: "3xl",
      elements: {
        podiumItem: {
          structure: "Circular avatar with crown, name, and points",
          avatar: {
            size: "80px",
            borderRadius: "full",
            border: "3px solid accent color based on rank"
          },
          crown: {
            size: "24px",
            color: "accent.yellow for #1, accent.green for others",
            position: "absolute top-right of avatar"
          },
          rank: {
            fontSize: "2xl",
            fontWeight: "bold",
            color: "blue_600",
            position: "overlay on avatar"
          },
          name: {
            fontSize: "sm",
            fontWeight: "medium",
            color: "theme.text.primary",
            marginTop: "sm"
          },
          points: {
            fontSize: "xs",
            color: "theme.text.secondary",
            marginTop: "xs"
          }
        },
        positioning: {
          first: "center, slightly elevated",
          second: "left of center",
          third: "right of center"
        }
      }
    },

    leaderboardList: {
      structure: "Scrollable list starting from rank 4",
      spacing: "sm between items",
      elements: {
        listItem: {
          structure: "Horizontal card with rank, avatar, name, and points",
          height: "64px",
          padding: "lg",
          background: "theme.background.card",
          borderRadius: "lg",
          border: "1px solid theme.border",
          layout: "flex items-center justify-between",
          elements: {
            leftSection: {
              layout: "flex items-center",
              spacing: "md",
              elements: {
                rank: {
                  fontSize: "lg",
                  fontWeight: "semibold",
                  color: "theme.text.secondary",
                  minWidth: "24px"
                },
                avatar: {
                  size: "40px",
                  borderRadius: "full"
                },
                name: {
                  fontSize: "base",
                  fontWeight: "medium",
                  color: "theme.text.primary"
                }
              }
            },
            rightSection: {
              points: {
                fontSize: "sm",
                fontWeight: "medium",
                color: "theme.text.secondary"
              }
            }
          }
        },
        currentUserHighlight: {
          condition: "when item represents current user",
          background: "blue_100 (light) / blue_900 (dark)",
          border: "2px solid blue_600",
          name: {
            color: "blue_600",
            fontWeight: "semibold"
          }
        }
      }
    }
  },

  interactions: {
    listItemHover: {
      background: "theme.background.elevated",
      transform: "scale(1.02)",
      transition: "all 0.2s ease"
    },
    buttonPress: {
      transform: "scale(0.95)",
      transition: "transform 0.1s ease"
    }
  },

  responsive: {
    mobile: {
      breakpoint: "< 768px",
      container: {
        padding: "lg",
        maxWidth: "100%"
      },
      podium: {
        avatarSize: "80px",
        spacing: "xl"
      },
      listItem: {
        height: "64px",
        fontSize: "base"
      }
    },
    tablet: {
      breakpoint: "768px - 1024px",
      container: {
        padding: "2xl",
        maxWidth: "640px",
        margin: "0 auto"
      },
      podium: {
        avatarSize: "96px",
        spacing: "2xl"
      }
    }
  },

  animations: {
    fadeIn: {
      duration: "0.3s",
      easing: "ease-out",
      from: "opacity: 0, translateY: 10px",
      to: "opacity: 1, translateY: 0"
    },
    staggeredList: {
      description: "Each list item animates in with slight delay",
      delay: "0.1s incremental per item"
    }
  },

  accessibility: {
    contrast: "WCAG AA compliant ratios",
    focusVisible: "2px solid blue_600 with 2px offset",
    semantics: {
      list: "Use proper list semantics for leaderboard",
      landmarks: "Header, main content regions",
      announcements: "Screen reader friendly rank and score announcements"
    }
  },

  implementation: {
    framework: "React/Vue/Angular compatible",
    stateManagement: "Theme switching, user highlighting, data loading states",
    dataStructure: {
      leaderboardEntry: {
        id: "string",
        rank: "number",
        name: "string",
        avatarUrl: "string",
        points: "number",
        isCurrentUser: "boolean"
      }
    }
  }
}

// Utility functions for accessing design system tokens
export const getLeaderboardToken = (path) => {
  const keys = path.split('.')
  let value = leaderboardDesignSystem
  
  for (const key of keys) {
    if (value && typeof value === 'object' && key in value) {
      value = value[key]
    } else {
      console.warn(`Leaderboard design token not found: ${path}`)
      return null
    }
  }
  
  return value
}

// Helper to get color values with fallbacks
export const getLeaderboardColor = (colorPath) => {
  const color = getLeaderboardToken(`colorPalette.${colorPath}`)
  return color || '#000000'
}

// Helper to get spacing values
export const getLeaderboardSpacing = (spacingKey) => {
  const spacing = getLeaderboardToken(`spacing.${spacingKey}`)
  return spacing || '16px'
}

// Helper to get typography values
export const getLeaderboardTypography = (typographyKey) => {
  const typography = getLeaderboardToken(`typography.${typographyKey}`)
  return typography || {}
}

// Helper to get theme values
export const getLeaderboardTheme = (theme, path) => {
  const themeValue = getLeaderboardToken(`themes.${theme}.${path}`)
  if (themeValue && themeValue.startsWith('blue_')) {
    return getLeaderboardColor(`primary.${themeValue}`)
  }
  if (themeValue && themeValue.startsWith('gray_')) {
    return getLeaderboardColor(`neutral.${themeValue}`)
  }
  return themeValue
}
