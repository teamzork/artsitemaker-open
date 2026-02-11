// packages/admin/src/pages/api/nav.ts
import type { APIRoute } from 'astro';
import fs from 'fs/promises';
import path from 'path';
import yaml from 'js-yaml';
import { getSettingsFilePath } from '../../lib/config-paths';

// Navigation config is stored in settings.yaml under the nav key
// Structure: { showLogo: boolean, items: Array<{label, href, external?}> }

interface NavItem {
    label: string;
    href: string;
    external?: boolean;
}

interface NavConfig {
    showLogo: boolean;
    items: NavItem[];
}

const DEFAULT_NAV_CONFIG: NavConfig = {
    showLogo: true,
    items: [
        { label: 'Gallery', href: '/' },
        { label: 'Slideshow', href: '/slideshow' },
        { label: 'About', href: '/about' }
    ]
};

// Helper to load nav config from settings.yaml
async function loadNavConfig(): Promise<NavConfig> {
    try {
        const settingsPath = getSettingsFilePath();
        const content = await fs.readFile(settingsPath, 'utf-8');
        const settings = yaml.load(content) as any;
        
        if (settings?.nav) {
            return {
                showLogo: settings.nav.showLogo !== false,
                items: settings.nav.items || DEFAULT_NAV_CONFIG.items
            };
        }
    } catch (e) {
        // File doesn't exist or can't be read, use defaults
    }
    
    return DEFAULT_NAV_CONFIG;
}

// Helper to save nav config to settings.yaml
async function saveNavConfig(config: NavConfig): Promise<void> {
    const settingsPath = getSettingsFilePath();
    
    // Load existing settings
    let settings: any = {};
    try {
        const content = await fs.readFile(settingsPath, 'utf-8');
        settings = yaml.load(content) as any;
    } catch {
        // File doesn't exist, start fresh
    }
    
    // Update nav config
    settings.nav = config;
    
    // Ensure directory exists
    const settingsDir = path.dirname(settingsPath);
    await fs.mkdir(settingsDir, { recursive: true });
    
    // Write updated settings
    const yamlContent = yaml.dump(settings, {
        lineWidth: -1,
        quotingType: '"'
    });
    await fs.writeFile(settingsPath, yamlContent, 'utf-8');
}

/**
 * GET /api/nav - Get current navigation configuration
 */
export const GET: APIRoute = async () => {
    try {
        const nav = await loadNavConfig();
        
        return new Response(JSON.stringify({ nav }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });
    } catch (error) {
        console.error('Failed to load navigation config:', error);
        return new Response(JSON.stringify({ 
            error: 'Failed to load navigation config',
            nav: DEFAULT_NAV_CONFIG 
        }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
};

/**
 * PUT /api/nav - Update navigation configuration
 */
export const PUT: APIRoute = async ({ request }) => {
    try {
        const updates = await request.json();
        
        // Load existing config
        const existing = await loadNavConfig();
        
        // Validate and merge updates
        const config: NavConfig = {
            showLogo: typeof updates.showLogo === 'boolean' ? updates.showLogo : existing.showLogo,
            items: Array.isArray(updates.items) ? validateNavItems(updates.items) : existing.items
        };
        
        // Save config
        await saveNavConfig(config);
        
        return new Response(JSON.stringify({
            success: true,
            nav: config
        }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });
    } catch (error: any) {
        console.error('Failed to update navigation config:', error);
        return new Response(JSON.stringify({ 
            error: error.message || 'Failed to update navigation config' 
        }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
};

// Validate navigation items
function validateNavItems(items: any[]): NavItem[] {
    return items.map(item => ({
        label: String(item.label || ''),
        href: String(item.href || ''),
        external: item.external === true || (item.href && (item.href.startsWith('http://') || item.href.startsWith('https://')))
    })).filter(item => item.label.trim() && item.href.trim());
}
