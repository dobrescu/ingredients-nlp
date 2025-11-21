#!/bin/bash
#
# Example API requests for Ingredients NLP service
#

# Configuration
API_URL="${API_URL:-http://localhost:3000}"

echo "🧪 Testing Ingredients NLP API"
echo "API URL: ${API_URL}"
echo ""

# Health check
echo "📊 Health Check"
curl -s "${API_URL}/health" | jq .
echo ""
echo ""

# Basic ingredient parsing
echo "🔍 Parse Basic Ingredients"
curl -s -X POST "${API_URL}/parse" \
    -H "Content-Type: application/json" \
    -d '{
        "ingredients": [
            "2 cups flour",
            "1 teaspoon salt",
            "3 tablespoons butter"
        ]
    }' | jq .
echo ""
echo ""

# Complex ingredients
echo "🔬 Parse Complex Ingredients"
curl -s -X POST "${API_URL}/parse" \
    -H "Content-Type: application/json" \
    -d '{
        "ingredients": [
            "3 pounds pork shoulder, cut into 2-inch chunks",
            "1 large onion, diced",
            "2-3 cloves garlic, minced",
            "1 1/2 cups chicken stock",
            "salt and pepper to taste"
        ]
    }' | jq .
echo ""
echo ""

# Recipe example
echo "🍳 Parse Recipe Ingredients"
curl -s -X POST "${API_URL}/parse" \
    -H "Content-Type: application/json" \
    -d '{
        "ingredients": [
            "2 cups all-purpose flour",
            "2 teaspoons baking powder",
            "1/2 teaspoon salt",
            "1/2 cup unsalted butter, softened",
            "1 cup granulated sugar",
            "2 large eggs",
            "1 teaspoon vanilla extract",
            "1/2 cup whole milk"
        ]
    }' | jq .
echo ""
echo ""

# Error case: empty list
echo "❌ Error: Empty Ingredients List"
curl -s -X POST "${API_URL}/parse" \
    -H "Content-Type: application/json" \
    -d '{
        "ingredients": []
    }' | jq .
echo ""
echo ""

# Error case: missing field
echo "❌ Error: Missing Ingredients Field"
curl -s -X POST "${API_URL}/parse" \
    -H "Content-Type: application/json" \
    -d '{}' | jq .
echo ""
echo ""

# Error case: invalid type
echo "❌ Error: Invalid Type"
curl -s -X POST "${API_URL}/parse" \
    -H "Content-Type: application/json" \
    -d '{
        "ingredients": "not a list"
    }' | jq .
echo ""
echo ""

echo "✅ Testing complete!"
