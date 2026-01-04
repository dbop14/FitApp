// Design System Configuration
// Extracted from FitApp Login UI.json

export const designSystem = {
  colors: {
    primary: {
      blue_50: '#eff6ff',
      blue_100: '#dbeafe', 
      blue_200: '#bfdbfe',
      blue_300: '#93c5fd',
      blue_400: '#60a5fa',
      blue_500: '#3b82f6',
      blue_600: '#035FC3',
      blue_700: '#1d4ed8',
      blue_800: '#1e40af',
      blue_900: '#1e3a8a'
    },
    neutrals: {
      white: '#ffffff',
      gray_50: '#f9fafb',
      gray_100: '#f3f4f6',
      gray_200: '#e5e7eb',
      gray_300: '#d1d5db',
      gray_400: '#9ca3af',
      gray_500: '#6b7280',
      gray_600: '#4b5563',
      gray_700: '#374151',
      gray_800: '#1f2937',
      gray_900: '#111827'
    },
    semantic: {
      success: '#10B981',
      warning: '#F59E0B',
      error: '#EF4444',
      info: '#3B82F6'
    }
  },
  
  gradients: {
    background: 'linear-gradient(135deg, #F8FAFC 0%, #E2E8F0 100%)',
    card_subtle: 'linear-gradient(145deg, #FFFFFF 0%, #F8FAFC 100%)'
  },
  
  typography: {
    fontFamily: {
      primary: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      display: '"Inter", -apple-system, BlinkMacSystemFont, sans-serif'
    },
    fontSizes: {
      xs: '0.75rem',      // 12px
      sm: '0.875rem',     // 14px
      base: '1rem',       // 16px
      lg: '1.125rem',     // 18px
      xl: '1.25rem',      // 20px
      '2xl': '1.5rem',    // 24px
      '3xl': '1.875rem',  // 30px
      '4xl': '2.25rem',   // 36px
      '5xl': '3rem',      // 48px
      '6xl': '3.75rem'    // 60px
    },
    fontWeights: {
      light: 300,
      normal: 400,
      medium: 500,
      semibold: 600,
      bold: 700,
      extrabold: 800
    },
    lineHeights: {
      tight: 1.1,
      normal: 1.2,
      relaxed: 1.3,
      loose: 1.4
    },
    // Specific typography from JSON
    hierarchy: {
      page_title: {
        size: '28px',
        weight: 600,
        lineHeight: 1.2,
        color: 'blue_600'
      },
      section_heading: {
        size: '48px',
        weight: 700,
        lineHeight: 1.1,
        color: 'gray_900'
      },
      body_text: {
        size: '14px',
        weight: 400,
        lineHeight: 1.4,
        color: 'gray_500'
      },
      button_text: {
        size: '16px',
        weight: 500,
        lineHeight: 1.3,
        color: 'white'
      },
      link_text: {
        size: '14px',
        weight: 500,
        lineHeight: 1.3,
        color: 'blue_600'
      }
    }
  },
  
  spacing: {
    base_unit: '4px',
    scale: {
      xs: '4px',
      sm: '8px', 
      md: '12px',
      lg: '16px',
      xl: '20px',
      '2xl': '24px',
      '3xl': '32px',
      '4xl': '48px'
    },
    component: {
      card_padding: '24px',
      card_gap: '16px',
      section_gap: '32px',
      grid_gap: '20px',
      between_form_fields: '16px',
      between_sections: '24px',
      button_internal_padding: '12px 16px',
      container_padding: '24px'
    }
  },
  
  borderRadius: {
    none: '0',
    sm: '4px',
    base: '8px',
    md: '12px',
    lg: '16px',
    xl: '20px',
    '2xl': '24px',
    full: '9999px'
  },
  
  shadows: {
    sm: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
    base: '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)',
    md: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
    lg: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
    card: '0 2px 8px rgba(0, 0, 0, 0.08)',
    card_hover: '0 4px 12px rgba(0, 0, 0, 0.12)'
  },
  
  layout: {
    grid: {
      columns: 12,
      gap: '20px',
      breakpoints: {
        sm: '640px',
        md: '768px',
        lg: '1024px',
        xl: '1280px',
        '2xl': '1536px'
      }
    },
    // Layout structure from JSON
    structure: {
      container: {
        type: 'mobile_screen',
        orientation: 'portrait',
        safe_area_respected: true,
        padding: '24px'
      },
      composition: {
        header_area: {
          position: 'top',
          height: 'auto',
          content: ['page_title', 'descriptive_text'],
          spacing: '16px_between_elements'
        },
        social_auth_section: {
          position: 'upper_middle',
          layout: 'horizontal_row',
          button_count: 2,
          button_spacing: '12px',
          margin_bottom: '24px'
        },
        divider_section: {
          type: 'text_divider',
          content: 'or',
          margin: '20px_vertical'
        },
        form_section: {
          position: 'middle',
          layout: 'vertical_stack',
          field_spacing: '16px',
          margin_bottom: '24px'
        },
        primary_action: {
          position: 'lower_middle',
          margin_bottom: '16px'
        },
        secondary_action: {
          position: 'bottom',
          layout: 'horizontal_centered'
        }
      }
    }
  },
  
  transitions: {
    default: 'all 0.2s ease',
    fast: 'all 0.15s ease',
    slow: 'all 0.3s ease'
  }
}

// Utility function to get design token values
export const getDesignToken = (path) => {
  const keys = path.split('.')
  let value = designSystem
  
  for (const key of keys) {
    if (value && typeof value === 'object' && key in value) {
      value = value[key]
    } else {
      console.warn(`Design token not found: ${path}`)
      return null
    }
  }
  
  return value
}

// Predefined component styles based on JSON specification
export const componentStyles = {
  // Social auth buttons from JSON
  socialAuthButton: {
    layout: 'side_by_side',
    button_style: {
      height: '48px',
      borderRadius: '8px',
      border: '1px solid gray_200',
      background: 'white',
      text_color: 'gray_700',
      fontWeight: 500,
      icon_position: 'left',
      icon_spacing: '8px'
    }
  },
  
  // Input fields from JSON
  inputField: {
    email_field: {
      type: 'email_input',
      height: '48px',
      borderRadius: '8px',
      border: '1px solid gray_200',
      background: 'gray_50',
      padding: '12px 16px',
      placeholder_color: 'gray_400',
      focus_state: {
        border_color: 'blue_600',
        outline: 'none'
      }
    },
    password_field: {
      type: 'password_input',
      height: '48px', 
      borderRadius: '8px',
      border: '1px solid gray_200',
      background: 'gray_50',
      padding: '12px 16px',
      placeholder_color: 'gray_400',
      show_hide_toggle: true,
      toggle_position: 'right',
      focus_state: {
        border_color: 'blue_600',
        outline: 'none'
      }
    }
  },
  
  // Primary button from JSON
  primaryButton: {
    height: '48px',
    borderRadius: '8px',
    background: 'blue_600',
    text_color: 'white',
    fontWeight: 500,
    border: 'none',
    width: '100%',
    hover_state: {
      background: 'blue_700'
    },
    active_state: {
      background: 'blue_800'
    }
  },
  
  // Text divider from JSON
  textDivider: {
    layout: 'horizontal_line_with_text',
    line_color: 'gray_200',
    text_background: 'white',
    text_color: 'gray_400',
    text_padding: '0 16px'
  },
  
  // Helper links from JSON
  helperLinks: {
    forgot_password: {
      position: 'right_aligned',
      text_color: 'blue_600',
      fontSize: '14px',
      margin_top: '8px'
    },
    signup_link: {
      layout: 'inline_with_text',
      base_text: 'Don\'t have account?',
      base_text_color: 'gray_600',
      link_text: 'Sign Up',
      link_color: 'blue_600'
    }
  },
  
  // Legacy component styles
  metricCard: {
    background: designSystem.colors.primary.blue_600,
    color: designSystem.colors.neutrals.white,
    padding: designSystem.spacing.component.card_padding,
    borderRadius: designSystem.borderRadius.lg,
    boxShadow: designSystem.shadows.card,
    transition: designSystem.transitions.default
  },
  
  chartCard: {
    background: designSystem.colors.neutrals.white,
    padding: designSystem.spacing.component.card_padding,
    borderRadius: designSystem.borderRadius.lg,
    boxShadow: designSystem.shadows.card,
    transition: designSystem.transitions.default
  },
  
  button: {
    primary: {
      background: designSystem.colors.primary.blue_600,
      color: designSystem.colors.neutrals.white,
      padding: '12px 24px',
      borderRadius: designSystem.borderRadius.md,
      fontWeight: designSystem.typography.fontWeights.medium,
      transition: designSystem.transitions.default
    }
  }
}
