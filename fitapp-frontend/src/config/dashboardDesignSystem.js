// Dashboard Design System Configuration
// Extracted from fitness_design_system.json

export const dashboardDesignSystem = {
  colors: {
    primary: {
      blue_50: "#EBF4FF",
      blue_100: "#DBEAFE", 
      blue_200: "#BFDBFE",
      blue_300: "#93C5FD",
      blue_400: "#60A5FA",
      blue_500: "#3B82F6",
      blue_600: "#035FC3",
      blue_700: "#1D4ED8",
      blue_800: "#1E40AF",
      blue_900: "#1E3A8A"
    },
    neutral: {
      white: "#FFFFFF",
      gray_50: "#F9FAFB",
      gray_100: "#F3F4F6",
      gray_200: "#E5E7EB",
      gray_300: "#D1D5DB",
      gray_400: "#9CA3AF",
      gray_500: "#6B7280",
      gray_600: "#4B5563",
      gray_700: "#374151",
      gray_800: "#1F2937",
      gray_900: "#111827"
    },
    accent: {
      purple: "#8B5CF6",
      teal: "#14B8A6",
      orange: "#F97316"
    }
  },

  typography: {
    fontFamily: "system-ui, -apple-system, sans-serif",
    hierarchy: {
      h1: {
        fontSize: "24px",
        fontWeight: "700",
        lineHeight: "1.2",
        color: "gray_900"
      },
      h2: {
        fontSize: "20px",
        fontWeight: "600", 
        lineHeight: "1.3",
        color: "gray_900"
      },
      h3: {
        fontSize: "18px",
        fontWeight: "600",
        lineHeight: "1.4",
        color: "gray_800"
      },
      body: {
        fontSize: "16px",
        fontWeight: "400",
        lineHeight: "1.5",
        color: "gray_700"
      },
      caption: {
        fontSize: "14px",
        fontWeight: "400",
        lineHeight: "1.4",
        color: "gray_500"
      },
      small: {
        fontSize: "12px",
        fontWeight: "400",
        lineHeight: "1.3",
        color: "gray_400"
      }
    }
  },

  spacing: {
    xs: "4px",
    sm: "8px", 
    md: "16px",
    lg: "24px",
    xl: "32px",
    xxl: "48px",
    mobile: {
      containerPadding: "clamp(16px, 4vw, 24px)",
      cardGap: "clamp(12px, 3vw, 16px)",
      sectionGap: "clamp(20px, 5vw, 32px)"
    }
  },

  borderRadius: {
    sm: "8px",
    md: "12px",
    lg: "16px",
    xl: "20px",
    full: "9999px"
  },

  shadows: {
    card: "0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)",
    elevated: "0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)"
  },

  layout: {
    container: {
      width: "100%",
      maxWidth: "430px",
      minWidth: "320px",
      padding: "16px",
      margin: "0 auto",
      backgroundColor: "white"
    },
    viewport: {
      meta: "width=device-width, initial-scale=1.0, viewport-fit=cover",
      minHeight: "100vh",
      overflowX: "hidden"
    },
    statusBar: {
      height: "44px",
      backgroundColor: "transparent",
      textColor: "gray_900",
      paddingTop: "env(safe-area-inset-top)"
    },
    safeArea: {
      paddingTop: "env(safe-area-inset-top)",
      paddingBottom: "env(safe-area-inset-bottom)",
      paddingLeft: "env(safe-area-inset-left)",
      paddingRight: "env(safe-area-inset-right)"
    }
  },

  components: {
    header: {
      structure: {
        type: "flex_row",
        justifyContent: "space-between",
        alignItems: "center",
        padding: "md",
        marginBottom: "lg"
      },
      greeting: {
        fontSize: "h2",
        fontWeight: "600",
        color: "gray_900"
      },
      subtitle: {
        fontSize: "body",
        color: "gray_500",
        marginTop: "xs"
      },
      avatar: {
        size: "48px",
        borderRadius: "full",
        border: "2px solid blue_200"
      }
    },

    activityCard: {
      structure: {
        type: "card",
        display: "flex_row",
        alignItems: "center",
        padding: "clamp(16px, 4vw, 24px)",
        marginBottom: "clamp(12px, 3vw, 16px)",
        backgroundColor: "white",
        borderRadius: "lg",
        shadow: "card"
      },
      responsive: {
        smallScreens: {
          maxWidth: "360px",
          imageArea: {
            width: "60px",
            height: "60px"
          },
          padding: "12px",
          title: {
            fontSize: "16px"
          }
        },
        mediumScreens: {
          maxWidth: "430px",
          imageArea: {
            width: "80px", 
            height: "80px"
          },
          padding: "20px"
        }
      },
      contentArea: {
        flex: 1,
        marginRight: "clamp(12px, 3vw, 20px)",
        minWidth: 0
      },
      title: {
        fontSize: "clamp(16px, 4.5vw, 18px)",
        fontWeight: "600",
        color: "gray_900",
        marginBottom: "xs",
        lineHeight: "1.3"
      },
      metrics: {
        display: "flex_column",
        gap: "xs",
        flexWrap: "wrap"
      },
      metricItem: {
        fontSize: "clamp(12px, 3.5vw, 14px)",
        color: "gray_500",
        display: "flex_row",
        alignItems: "center",
        gap: "xs"
      },
      imageArea: {
        width: "clamp(60px, 15vw, 80px)",
        height: "clamp(60px, 15vw, 80px)",
        borderRadius: "md",
        overflow: "hidden",
        flexShrink: 0
      },
      colorVariants: {
        yoga: {
          backgroundColor: "gray_50",
          accentColor: "blue_600"
        },
        pilates: {
          backgroundColor: "purple",
          textColor: "white"
        },
        fullBody: {
          backgroundColor: "teal", 
          textColor: "white"
        }
      }
    },

    progressBanner: {
      structure: {
        type: "card",
        padding: "lg",
        backgroundColor: "blue_50",
        borderRadius: "lg",
        border: "1px solid blue_200",
        marginTop: "lg"
      },
      title: {
        fontSize: "body",
        fontWeight: "600",
        color: "blue_800",
        marginBottom: "xs"
      },
      subtitle: {
        fontSize: "caption", 
        color: "blue_600"
      },
      icon: {
        size: "20px",
        color: "blue_600",
        marginRight: "sm"
      }
    },

    bottomNavigation: {
      structure: {
        position: "fixed",
        bottom: "0",
        left: "0", 
        right: "0",
        height: "clamp(70px, 18vw, 88px)",
        backgroundColor: "white",
        borderTop: "1px solid gray_200",
        padding: "sm lg",
        paddingBottom: "calc(8px + env(safe-area-inset-bottom))"
      },
      items: {
        display: "flex_row",
        justifyContent: "space-around",
        alignItems: "center"
      },
      activeState: {
        color: "blue_600"
      },
      inactiveState: {
        color: "gray_400"
      },
      touchTarget: {
        minWidth: "44px",
        minHeight: "44px",
        padding: "12px"
      }
    }
  },

  patterns: {
    cardGrid: {
      description: "Vertical stack of activity cards with consistent spacing",
      gap: "md",
      padding: "md"
    },
    metricDisplay: {
      description: "Small text with icon/bullet point, used for exercise count, duration, etc.",
      format: "[icon] [number] [unit]",
      textStyle: "caption",
      color: "gray_500"
    },
    colorCodedCards: {
      description: "Cards use different background colors to categorize content types",
      variants: ["neutral_light", "purple", "teal", "blue_accent"]
    }
  },

  interactions: {
    cardTap: {
      feedback: "subtle_scale",
      duration: "150ms"
    },
    navigationTap: {
      feedback: "color_change",
      activeColor: "blue_600"
    }
  },

  accessibility: {
    minimumTouchTarget: "44px",
    contrastRatio: "4.5:1",
    focusIndicator: "2px solid blue_600",
    mobile: {
      touchTargets: "All interactive elements minimum 44px x 44px",
      textScaling: "Supports system font scaling up to 200%",
      reducedMotion: "Respects prefers-reduced-motion settings"
    }
  },

  implementationGuidelines: {
    cardLayout: "Use flex-row for horizontal content alignment with image on right",
    spacing: "Consistent clamp() values for responsive spacing that scales with viewport",
    imageHandling: "Responsive images 60-80px with maintained aspect ratio",
    colorApplication: "Use color variants to distinguish content categories, maintain text contrast",
    responsiveness: "Fluid width 320px-430px, safe area insets for modern devices",
    performance: "Use CSS clamp() for efficient responsive scaling without media queries",
    mobileOptimizations: {
      touchTargets: "Minimum 44px tap targets with adequate spacing",
      safeAreaInsets: "Handle notches and home indicators with env() values",
      viewportHandling: "viewport-fit=cover for edge-to-edge layouts",
      textSizing: "Fluid typography with clamp() prevents text overflow",
      scrolling: "Smooth scrolling with momentum on iOS (-webkit-overflow-scrolling: touch)"
    }
  }
}

// Utility function to get design token values
export const getDashboardToken = (path) => {
  const keys = path.split('.')
  let value = dashboardDesignSystem
  
  for (const key of keys) {
    if (value && typeof value === 'object' && key in value) {
      value = value[key]
    } else {
      console.warn(`Dashboard design token not found: ${path}`)
      return null
    }
  }
  
  return value
}

// CSS-in-JS helper for responsive values
export const responsiveValue = (small, medium) => {
  return `clamp(${small}, ${medium}, ${medium})`
}

// Helper to get color values with fallbacks
export const getColor = (colorPath) => {
  const color = getDashboardToken(`colors.${colorPath}`)
  return color || '#000000'
}

// Helper to get spacing values
export const getSpacing = (spacingKey) => {
  const spacing = getDashboardToken(`spacing.${spacingKey}`)
  return spacing || '16px'
}

// Helper to get typography values
export const getTypography = (typographyKey) => {
  const typography = getDashboardToken(`typography.hierarchy.${typographyKey}`)
  return typography || {}
}
