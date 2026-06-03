public inherited sharing class CitadelUtil{

    public static String constructRequest(Map<String, Object> untypedMap, Map<String, String> fieldNameAPINodeMap) {
        String requestBody = ''; 
        if (untypedMap != null && !untypedMap.isEmpty()) {
            for (String fieldName : untypedMap.keySet()) {
                if (fieldNameAPINodeMap.containsKey(fieldName)) {
                    Object fieldValue = untypedMap.get(fieldName);
                    if (fieldValue != null) {
                        requestBody += fieldNameAPINodeMap.get(fieldName) + '=' + EncodingUtil.urlEncode(String.valueOf(fieldValue), 'UTF-8') + '&';
                    }
                }
            }
            requestBody = requestBody.removeEnd('&');
        }
        return requestBody;
    }
}