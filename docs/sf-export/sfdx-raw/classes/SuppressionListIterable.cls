public class SuppressionListIterable implements Iterable<String> {
    private Id contentDocumentId;

    public SuppressionListIterable(Id contentDocumentId) {
        this.contentDocumentId = contentDocumentId;
    }

    public Iterator<String> iterator() {
        List<String> phoneNumbers = new List<String>();

        ContentVersion cv = [
            SELECT Id, VersionData
            FROM ContentVersion
            WHERE ContentDocumentId = :contentDocumentId
            ORDER BY CreatedDate DESC
            LIMIT 1
        ];

        Blob fileBody = cv.VersionData;
        String fileContent = fileBody.toString();
        
        List<String> lines = new List<String>();
        Integer start = 0;
        Integer next = fileContent.indexOf('\n');
        
        while (next != -1) {
            lines.add(fileContent.substring(start, next));
            start = next + 1;
            next = fileContent.indexOf('\n', start);
        }
        
        if (start < fileContent.length()) {
            lines.add(fileContent.substring(start));
        }
        for (Integer i = 1; i < lines.size(); i++) {
            String line = lines[i].trim();
            if (!String.isBlank(line)) {
                Integer commaIndex = line.indexOf(',');
                String phone = (commaIndex != -1) ? line.substring(0, commaIndex).trim() : line.trim();
                if (!String.isBlank(phone)) {
                    phoneNumbers.add(phone.replaceAll('[^0-9]', ''));
                }
            }
        }
        
        return phoneNumbers.iterator();
    }
}