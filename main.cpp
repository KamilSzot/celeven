#include "depends.h"


using namespace std;
using namespace boost::algorithm;
// using namespace boost::property_tree;

class Response;
class Html;

class JavaScript {
    friend Html;
    string output;

public:
    JavaScript() {
        output = "";
    }
    JavaScript(const char* s) : JavaScript((string)s) {
    };
    JavaScript(Json::Value s) {
        Json::FastWriter w;
        output = w.write(s);
        output.pop_back();
    }

    JavaScript(string s) : JavaScript(Json::Value(s)) {}
    JavaScript(int s) : JavaScript(Json::Value(s)) {}
    JavaScript(double s) : JavaScript(Json::Value(s)) {}
    JavaScript(float s) : JavaScript(Json::Value(s)) {}
    friend JavaScript operator"" _js(const char* str, long unsigned int);
    friend const JavaScript operator+(const JavaScript& a, const JavaScript& b) {
        JavaScript result;
        result.output = a.output + b.output;
        return result;
    }
};


JavaScript operator"" _js(const char* str, long unsigned int) {
    JavaScript h;
    h.output = str;
    return h;
}

class Html {
    friend Response;

    string _html;
public:
    Html() {
        _html = "";
    }
    Html(const char* s): Html((string)s) {
    }
    Html(string s) {
        _html = s;
        replace_all(_html, "<", "&lt;");
        replace_all(_html, ">", "&gt;");
    }
    Html(JavaScript s) {
        _html = "<script>" + replace_all_copy(s.output, "</script", "</scr\\ipt") + "</script>";
    }
//    Html(const char* s) {
//        _html = s;
//        replace_all(_html, "<", "&lt;");
//        replace_all(_html, ">", "&gt;");
//    }
    operator const string() const {
        string result(_html);

        return result;
    }
    friend Html operator"" _html(const char* html, long unsigned int);
//    friend inline std::ostream& operator<< (std::ostream &out,
//                                             const Html &b) {
//       const string s = b;
//       return out << s;
//    }
    friend const Html operator+(const Html& a, const Html& b) {
        Html result;
        result._html = a._html + b._html;
        return result;
    }
};


Html operator"" _html(const char* str, long unsigned int) {
    Html h;
    string s(str);
    h._html = s;
    return h;
}

class Response {
public:
    string respondWith(Html doc) {
        return doc._html;
    }

};


int main(void) {
    // Backup the stdio streambufs
    streambuf * cin_streambuf  = cin.rdbuf();
    streambuf * cout_streambuf = cout.rdbuf();
    streambuf * cerr_streambuf = cerr.rdbuf();

    FCGX_Request request;

    FCGX_Init();
    FCGX_InitRequest(&request, 0, 0);

    while (FCGX_Accept_r(&request) == 0) {
        fcgi_streambuf cin_fcgi_streambuf(request.in);
        fcgi_streambuf cout_fcgi_streambuf(request.out);
        fcgi_streambuf cerr_fcgi_streambuf(request.err);

        cin.rdbuf(&cin_fcgi_streambuf);
        cout.rdbuf(&cout_fcgi_streambuf);
        cerr.rdbuf(&cerr_fcgi_streambuf);

	string title = "<script>alert(1)</script>";
	Html result = R"(
	  <html>
	    <head>
	      <meta http-equiv="content-type" content="text/html; charset=utf-8">
	    </head>
	    <body>
	    śłąg ---
	    <h1>.)"_html + title + R"(</h1>)"_html + 
	 ("var a = "_js + "</script>" + ";"_js) +
	 "</body></html>"_html;
	
	Response response;

        cout << "Content-type: text/html\r\n"
             << "\r\n";
	cout << response.respondWith(result);
	
        // Note: the fcgi_streambuf destructor will auto flush
    }

    // restore stdio streambufs
    cin.rdbuf(cin_streambuf);
    cout.rdbuf(cout_streambuf);
    cerr.rdbuf(cerr_streambuf);

    return 0;
}