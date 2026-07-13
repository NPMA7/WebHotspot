const { parse } = require('csv-parse/sync');

/**
 * Parse CSV buffer menjadi array of hotspot user objects
 * Kolom yang diharapkan: username, password, bandwidth_limit, website_block, router_id
 * @param {Buffer} buffer - File buffer dari multer
 * @returns {Array} - Array of user objects
 */
const parseCSVUsers = (buffer) => {
    const content = buffer.toString('utf-8');

    const records = parse(content, {
        columns: true,
        skip_empty_lines: true,
        trim: true,
        cast: (value, context) => {
            if (context.column === 'website_block') {
                return value || '';
            }
            if (context.column === 'router_id') {
                const num = parseInt(value);
                return isNaN(num) ? null : num;
            }
            return value;
        }
    });

    // Validasi dan filter
    const validUsers = [];
    const errors = [];

    records.forEach((record, index) => {
        const row = index + 2; // +2 karena header + 1-based

        if (!record.username || !record.username.trim()) {
            errors.push({ row, message: 'Username tidak boleh kosong' });
            return;
        }
        if (!record.password || !record.password.trim()) {
            errors.push({ row, message: `Username "${record.username}": password tidak boleh kosong` });
            return;
        }

        // Validasi format bandwidth_limit
        const bwLimit = record.bandwidth_limit || '10M/10M';
        const bwRegex = /^\d+[KMG]\/\d+[KMG]$/i;
        if (!bwRegex.test(bwLimit)) {
            errors.push({ row, message: `Username "${record.username}": format bandwidth_limit tidak valid (contoh: 10M/10M)` });
            return;
        }

        validUsers.push({
            username:        record.username.trim().toLowerCase(),
            password:        record.password.trim(),
            bandwidth_limit: bwLimit.toUpperCase(),
            website_block:   record.website_block || '',
            router_id:       record.router_id     || null,
        });
    });

    return { users: validUsers, errors };
};

module.exports = { parseCSVUsers };
