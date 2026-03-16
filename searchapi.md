

Google Search API
GET
 
/api/v1/search?engine=google
Download OpenAPI Spec

API Parameters
Search Query
Name
q
Required
Required
Description
This parameter is used for the terms you want to search on Google. Queries can include operators and advanced filters like "machine learning models", site:, inurl:, intitle:, AND, or OR.

Name
kgmid
Required
Optional
Description
Defines a Knowledge Graph identifier (kgmid), representing entities in Google's Knowledge Graph. Format:

Location Identifier (/m/): Typically followed by 2 to 7 characters. Used primarily to represent specific locations. Find the identifier by searching for the "Freebase ID" on Wikidata. Example: kgmid=/m/02_286 refers to New York.
Google Knowledge Graph Identifier (/g/): Typically followed by a longer alphanumeric string. Represents general entities in Google's Knowledge Graph. Find details on Wikidata. Example: kgmid=/g/11f555cn8l refers to TikTok.
Device
Name
device
Required
Optional
Description
The default parameter desktop defines the search on a desktop device. The mobile parameter defines the search on a mobile device. The tablet parameter defines the search on a tablet device.

Geographic Location
Name
location
Required
Optional
Description
This parameter is used to specify the canonical location of the search. For exact targeting or to see all available options, check out the Locations API. If multiple locations match your input, the most popular one will be selected.
For example - location=New York would select New York,United States or location=London would select London TV Region,England,United Kingdom.

Name
uule
Required
Optional
Description
This parameter sets the exact Google-encoded location for the search, and uule and location cannot be used at the same time. SearchApi builds it for you when you use the location parameter, but you can provide your own if you want precise control.

Localization
Name
google_domain
Deprecated
Deprecated
Required
Optional
Description
As of Apr 15, 2025, Google began phasing out country code top-level domains (ccTLDs). Users using the search bar or visiting local domains like google.de or google.co.uk are now automatically redirected to google.com. For localized searches, use the gl (country), hl (language) or other localization parameters instead. Learn more in Google's official announcement. See the full list of supported Google domains.

Name
gl
Required
Optional
Description
The default parameter us defines the country of the search. Check the full list of supported Google gl countries.

Name
hl
Required
Optional
Description
The default parameter en defines the interface language of the search. Check the full list of supported Google hl languages.

Name
lr
Required
Optional
Description
The lr parameter restricts search results to documents written in a particular language or a set of languages. The accepted format for this parameter is lang_{2-letter country code}. For instance, to filter documents written in Japanese, the value should be set to lang_jp. To incorporate multiple languages, a value like lang_it|lang_de restricts the search to documents written in either Italian or German. Google identifies the document language based on the top-level domain (TLD) of the document's URL, any language meta tags present, or the language utilized within the document's body text. Check the full list of supported Google lr languages.

Name
cr
Required
Optional
Description
The cr parameter restricts search results to documents originating in a particular country. Google determines the country of a document by the top-level domain (TLD) of the document's URL or by Web server's IP address geographic location. Check the full list of supported Google cr countries.

Filters
Name
nfpr
Required
Optional
Description
This parameter controls whether results from queries that have been auto-corrected for spelling errors are included. To exclude these auto-corrected results, set the value to 1. By default, the value is 0, meaning auto-corrected results are included.

Name
filter
Required
Optional
Description
This parameter controls whether the "Duplicate Content" and "Host Crowding" filters are enabled. Set the value to 1 to enable these filters, which is the default setting. To disable these filters, set the value to 0.

Name
safe
Required
Optional
Description
This parameter toggles the SafeSearch feature for the results. SafeSearch operates by filtering out adult content from your search results. Google's filters use proprietary technology to check keywords, phrases and URLs. While no filters are 100 percent accurate, SafeSearch will remove the overwhelming majority of adult content from your search results. Supported values are active to enable strict SafeSearch, blur to blur explicit images, and off to disable SafeSearch. By default, the value is blur.

Name
time_period
Required
Optional
Description
This parameter restricts results to URLs based on date. Supported values are:

last_1_minute - data from the past minute.
last_5_minutes - data from the past 5 minutes.
last_15_minutes - data from the past 15 minutes.
last_30_minutes - data from the past 30 minutes.
last_hour - data from the past hour.
last_day - data from the past 24 hours.
last_week - data from the past week.
last_month - data from the past month.
last_year - data from the past year.
Using time_period_min or time_period_max parameters, you can specify a custom time period.
Note, that the time_period_min and time_period_max parameters could be used separately as well.
Name
time_period_min
Required
Optional
Description
This parameter specifies the start of the time period. It could be used in combination with the time_period_max parameter. The value should be in the format MM/DD/YYYY.

Name
time_period_max
Required
Optional
Description
This parameter specifies the end of the time period. It could be used in combination with the time_period_min parameter. The value should be in the format MM/DD/YYYY.

Pagination
Name
num
Required
Optional
Description
Phased out by Google on September 2025. It is now constant 10. Check the Google Rank Tracking API for num=100 support.

Name
page
Required
Optional
Description
This parameter indicates which page of results to return. By default, it is set to 1.

Optimization
Name
optimization_strategy
Required
Optional
Description
Controls how the search request is optimized. Available options:

performance
Default
ads - optimizes for higher ad collection success rate, which may result in longer request processing times.
Engine
Name
engine
Required
Required
Description
Parameter defines an engine that will be used to retrieve real-time data. It must be set to google.

API key
Name
api_key
Required
Required
Description
The api_key authenticates your requests. Use it as a query parameter (https://www.searchapi.io/api/v1/search?api_key=YOUR_API_KEY) or in the Authorization header (Bearer YOUR_API_KEY).

Zero Data Retention
Name
zero_retention
Enterprise Only
Enterprise Only
Required
Optional
Description
Set this parameter to true to disable all logging and persistent storage. No request parameters, HTML, or JSON responses are stored or logged. Suitable for high-compliance use cases. Debugging and support may be limited while enabled.

API Examples
Full Response - Search for 'chatgpt'
Full Response - Search for 'chatgpt'
GET
Open url
https://www.searchapi.io/api/v1/search?api_key=Yo7Z933pdWGVYZssKMgQh7im&engine=google&q=chatgpt
Request

Python

requests
import requests

url = "https://www.searchapi.io/api/v1/search"
params = {
  "engine": "google",
  "q": "chatgpt",
  "api_key": "Yo7Z933pdWGVYZssKMgQh7im"
}

response = requests.get(url, params=params)
print(response.text)
Copy code
Response
{
  "search_metadata": {
    "id": "search_MJjKW8mR3ZGJsDjepn9redbv",
    "status": "Success",
    "created_at": "2024-10-29T10:10:13Z",
    "request_time_taken": 1.28,
    "parsing_time_taken": 0.1,
    "total_time_taken": 1.29,
    "request_url": "https://www.google.com/search?q=chatgpt&oq=chatgpt&gl=us&hl=en&uule=w+CAIQICIWTmV3IFlvcmssVW5pdGVkIFN0YXRlcw&ie=UTF-8",
    "html_url": "https://www.searchapi.io/api/v1/searches/search_MJjKW8mR3ZGJsDjepn9redbv.html",
    "json_url": "https://www.searchapi.io/api/v1/searches/search_MJjKW8mR3ZGJsDjepn9redbv"
  },
  "search_parameters": {
    "engine": "google",
    "q": "chatgpt",
    "device": "desktop",
    "location": "New York,United States",
    "location_used": "New York,United States",
    "hl": "en",
    "gl": "us"
  },
  "search_information": {
    "query_displayed": "chatgpt",
    "total_results": 945000000,
    "time_taken_displayed": 0.29,
    "detected_location": "New York"
  },
  "knowledge_graph": {
    "kgmid": "/g/11khcfz0y2",
    "knowledge_graph_type": "Kp3 verticals",
    "title": "ChatGPT",
    "type": "Software",
    "description": "ChatGPT is a generative artificial intelligence chatbot developed by OpenAI and launched in 2022. It is based on the GPT-4o large language model.",
    "source": {
      "name": "Wikipedia",
      "link": "https://en.wikipedia.org/wiki/ChatGPT"
    },
    "initial_release_date": "November 30, 2022",
    "programming_language": "Python",
    "programming_language_links": [
      {
        "text": "Python",
        "link": "https://www.google.com/search?sca_esv=853f175af13f0422&gl=us&hl=en&q=Python&si=ACC90nyvvWro6QmnyY1IfSdgk5wwjB1r8BGd_IWRjXqmKPQqmwbtPHPEcZi5JOYKaqe_iu1m4TVPotntrDVKbuXCkoFhx-K-Dp6PbewOILPFWjhDofHha-WRuSQCgY7LnBkzXtVH7pxiRdHONv3wpVsflGBg_EdTHCxOnyWt1nDgBmCjsfchXU7DKtJq159-V0-seE_cp7VV&sa=X&ved=2ahUKEwi1u_bUrLOJAxVrEFkFHaOJJaUQmxMoAHoECC4QAg"
      }
    ],
    "developers": "OpenAI",
    "developers_links": [
      {
        "text": "OpenAI",
        "link": "https://www.google.com/search?sca_esv=853f175af13f0422&gl=us&hl=en&q=OpenAI&stick=H4sIAAAAAAAAAONgVuLVT9c3NEyqSDYzNSszW8TK5l-QmufoCQCnB8biGgAAAA&sa=X&ved=2ahUKEwi1u_bUrLOJAxVrEFkFHaOJJaUQmxMoAHoECDIQAg"
      }
    ],
    "engine": "GPT-4; GPT-4o; GPT-4o mini",
    "engine_links": [
      {
        "text": "GPT-4",
        "link": "https://www.google.com/search?sca_esv=853f175af13f0422&gl=us&hl=en&q=GPT-4&stick=H4sIAAAAAAAAAONgVuLVT9c3NMy2TI_PNUtOX8TK6h4QomsCAKiBOxkZAAAA&sa=X&ved=2ahUKEwi1u_bUrLOJAxVrEFkFHaOJJaUQmxMoAHoECDAQAg"
      },
      ...
    ],
    "license": "Proprietary",
    "platform": "Cloud computing platforms",
    "platform_links": [
      {
        "text": "Cloud computing",
        "link": "https://www.google.com/search?sca_esv=853f175af13f0422&gl=us&hl=en&q=Cloud+computing&stick=H4sIAAAAAAAAAONgVuLSz9U3MKqMt8w1XsTK75yTX5qikJyfW1BakpmXDgB-4JvxIAAAAA&sa=X&ved=2ahUKEwi1u_bUrLOJAxVrEFkFHaOJJaUQmxMoAHoECDEQAg"
      }
    ],
    "stable_release": "August 8, 2024; 2 months ago",
    "image": "data:image/png;base64,..."
  },
  "organic_results": [
    {
      "position": 1,
      "title": "Introducing ChatGPT",
      "link": "https://openai.com/index/chatgpt/",
      "source": "OpenAI",
      "domain": "openai.com",
      "displayed_link": "https://openai.com › index › chatgpt",
      "snippet": "ChatGPT is a sibling model to InstructGPT⁠, which is trained to follow an instruction in a prompt and provide a detailed response.",
      "snippet_highlighted_words": [
        "ChatGPT"
      ],
      "date": "Nov 30, 2022",
      "sitelinks": {
        "inline": [
          {
            "title": "Introducing GPT-4o and more...",
            "link": "https://openai.com/index/gpt-4o-and-more-tools-to-chatgpt-free/"
          },
          ...
        ]
      },
      "favicon": "data:image/png;base64,..."
    },
    ...
  ],
  "discussions_and_forums": [
    {
      "title": "Is ChatGPT replacing Google for \"basic, quick searches\"",
      "link": "https://www.reddit.com/r/ChatGPT/comments/1ge133w/is_chatgpt_replacing_google_for_basic_quick/",
      "source": "Reddit",
      "date": "21h ago",
      "posts": "190+ comments",
      "community": "r/ChatGPT",
      "favicon": "data:image/png;base64,..."
    },
    ...
  ],
  "inline_videos": [
    {
      "position": 1,
      "title": "3 ChatGPT Prompt Engineering Hacks You NEED to Start Using",
      "link": "https://www.youtube.com/watch?v=Xkrfm1VfETA",
      "source": "YouTube",
      "channel": "Nick Saraev",
      "date": "1 day ago",
      "length": "40:16",
      "image": "data:image/jpeg;base64,..."
    },
    ...
  ],
  "inline_videos_more_link": "https://www.google.com/search?sca_esv=853f175af13f0422&gl=us&hl=en&tbm=vid&q=chatgpt&sa=X&ved=2ahUKEwi1u_bUrLOJAxVrEFkFHaOJJaUQ8ccDegQIPhAH",
  "related_searches": [
    {
      "query": "ChatGPT login",
      "link": "https://www.google.com/search?sca_esv=853f175af13f0422&gl=us&hl=en&q=ChatGPT+login&sa=X&ved=2ahUKEwi1u_bUrLOJAxVrEFkFHaOJJaUQ1QJ6BAhHEAE"
    },
    ...
  ],
  "pagination": {
    "current": 1,
    "next": "https://www.google.com/search?q=chatgpt&oq=chatgpt&gl=us&hl=en&start=10&uule=w+CAIQICIWTmV3IFlvcmssVW5pdGVkIFN0YXRlcw&ie=UTF-8"
  }
}

Google Images API Documentation
GET
 
/api/v1/search?engine=google_images
Download OpenAPI Spec

Google Images API provides a dynamic image search service. It collects image results from various sources globally, categorizes similar images and presents them based on each user's search query. The API provides access to multiple sources for each image, allowing users to choose their topic of interest and select from different publishers' versions of the image. The selection and ranking of images are performed by algorithms that assess factors such as the relevance and quality of the image. It also prioritizes attributes like resolution, source, and freshness. The system is impartial, enabling access to a wide range of images for any search query. Google is continuously improving Images by adding new sources and enhancing its technology, extending its reach to more visual data worldwide.

API Parameters
Search Query
Name
q
Required
Required
Description
This parameter is used for the terms you want to search on Google Images. Queries can include operators and advanced filters like "cute cats", site:, inurl:, intitle:, as_dt, or as_eq.

Device
Name
device
Required
Optional
Description
The default parameter desktop defines the search on a desktop device. The mobile parameter defines the search on a mobile device. The tablet parameter defines the search on a tablet device.

Geographic Location
Name
location
Required
Optional
Description
This parameter is used to specify the canonical location of the search. For exact targeting or to see all available options, check out the Locations API. If multiple locations match your input, the most popular one will be selected.

Name
uule
Required
Optional
Description
This parameter sets the exact Google-encoded location for the search, and uule and location cannot be used at the same time. SearchApi builds it for you when you use the location parameter, but you can provide your own if you want precise control.

Localization
Name
google_domain
Deprecated
Deprecated
Required
Optional
Description
As of Apr 15, 2025, Google began phasing out country code top-level domains (ccTLDs). Users using the search bar or visiting local domains like google.de or google.co.uk are now automatically redirected to google.com. For localized searches, use the gl (country), hl (language) or other localization parameters instead. Learn more in Google's official announcement. See the full list of supported Google domains.

Name
gl
Required
Optional
Description
The default parameter us defines the country of the search. Check the full list of supported Google gl countries.

Name
hl
Required
Optional
Description
The default parameter en defines the interface language of the search. Check the full list of supported Google hl languages.

Name
lr
Required
Optional
Description
The lr parameter restricts search results to documents written in a particular language or a set of languages. The accepted format for this parameter is lang_{2-letter country code}. For instance, to filter documents written in Japanese, the value should be set to lang_jp. To incorporate multiple languages, a value like lang_it|lang_de restricts the search to documents written in either Italian or German. Google identifies the document language based on the top-level domain (TLD) of the document's URL, any language meta tags present, or the language utilized within the document's body text. Check the full list of supported Google lr languages.

Name
cr
Required
Optional
Description
The cr parameter restricts search results to documents originating in a particular country. Google determines the country of a document by the top-level domain (TLD) of the document's URL or by Web server's IP address geographic location. Check the full list of supported Google cr countries.

Filters
Name
nfpr
Required
Optional
Description
This parameter controls whether results from queries that have been auto-corrected for spelling errors are included. To exclude these auto-corrected results, set the value to 1. By default, the value is 0, meaning auto-corrected results are included.

Name
filter
Required
Optional
Description
This parameter controls whether the "Duplicate Content" and "Host Crowding" filters are enabled. Set the value to 1 to enable these filters, which is the default setting. To disable these filters, set the value to 0.

Name
safe
Required
Optional
Description
This parameter toggles the SafeSearch feature for the results. SafeSearch operates by filtering out adult content from your search results. Google's filters use proprietary technology to check keywords, phrases and URLs. While no filters are 100 percent accurate, SafeSearch will remove the overwhelming majority of adult content from your search results. Supported values are active to enable strict SafeSearch, blur to blur explicit images, and off to disable SafeSearch. By default, the value is blur.

Name
tbs
Required
Optional
Description
This parameter restricts results to URLs based on encoded values. Parameter is normally constructed using size, color, image_type, time_period, usage_rights values. For instance, isz:l would return only results that has large image size.

Name
size
Required
Optional
Description
This parameter controls the size of your search results. There are few options available: large, medium, icon, larger_than_400x300, larger_than_640x480, larger_than_800x600, larger_than_1024x768, larger_than_2mp, larger_than_4mp, larger_than_6mp, larger_than_8mp, larger_than_12mp, larger_than_15mp, larger_than_20mp, larger_than_40mp, larger_than_70mp.

Name
time_period
Required
Optional
Description
This parameter restricts results to URLs based on date. Supported values are: last_hour, last_day, last_week, last_month, last_year

Name
color
Required
Optional
Description
This parameter controls the color of your search results. These options are available: black_and_white, color, transparent, red, orange, yellow, green, teal, blue, purple, pink, white, gray, black, brown.

Name
image_type
Required
Optional
Description
This parameter controls the type of your search results. There are only few options that are available: clipart, line_drawing, gif, face, photo.

Name
usage_rights
Required
Optional
Description
This parameter controls the usage rights of your search results. Options that are available: creative_commons_licenses, commercial_or_other_licenses.

Name
aspect_ratio
Required
Optional
Description
This parameter filters images based on aspect ratio. Supported values are:

square - width equals height.
tall - height greater than width.
wide - width greater than height.
panoramic - width is at least twice the height.
Pagination
Name
page
Required
Optional
Description
This parameter indicates which page of results to return. By default, it is set to 1.

Engine
Name
engine
Required
Required
Description
Parameter defines an engine that will be used to retrieve real-time data. It must be set to google_images.

API key
Name
api_key
Required
Required
Description
The api_key authenticates your requests. Use it as a query parameter (https://www.searchapi.io/api/v1/search?api_key=YOUR_API_KEY) or in the Authorization header (Bearer YOUR_API_KEY).

Zero Data Retention
Name
zero_retention
Enterprise Only
Enterprise Only
Required
Optional
Description
Set this parameter to true to disable all logging and persistent storage. No request parameters, HTML, or JSON responses are stored or logged. Suitable for high-compliance use cases. Debugging and support may be limited while enabled.

API Examples
Full Response
Full Response
GET
Open url
https://www.searchapi.io/api/v1/search?api_key=Yo7Z933pdWGVYZssKMgQh7im&engine=google_images&q=apple
Request

Python

requests
import requests

url = "https://www.searchapi.io/api/v1/search"
params = {
  "engine": "google_images",
  "q": "apple",
  "api_key": "Yo7Z933pdWGVYZssKMgQh7im"
}

response = requests.get(url, params=params)
print(response.text)
Copy code
Response
{
  "search_metadata": {
    "id": "search_6EB5K71e3vjbfvQK3vXNW82V",
    "status": "Success",
    "created_at": "2024-11-28T10:55:15Z",
    "request_time_taken": 1.62,
    "parsing_time_taken": 0.04,
    "total_time_taken": 1.66,
    "request_url": "https://www.google.com/search?q=apple&oq=apple&gl=us&hl=en&ie=UTF-8&udm=2",
    "html_url": "https://www.searchapi.io/api/v1/searches/search_6EB5K71e3vjbfvQK3vXNW82V.html",
    "json_url": "https://www.searchapi.io/api/v1/searches/search_6EB5K71e3vjbfvQK3vXNW82V"
  },
  "search_parameters": {
    "engine": "google_images",
    "q": "apple",
    "device": "desktop",
    "hl": "en",
    "gl": "us"
  },
  "search_information": {
    "query_displayed": "apple",
    "detected_location": "Hollywood Hills, Hollywood, FL"
  },
  "suggestions": [
    {
      "title": "Fruit",
      "link": "https://www.google.com/search?sca_esv=4daba4fcecb7e45f&gl=us&hl=en&q=apple+fruit+images&uds=ADvngMjcH0KdF7qGWtwTBrP0nt7dJKTJ99uVgWVcr-vzrAPkVdeCsz9Gnf4fkyJt0_EDA4_G--7Wp9uLFH8uOgQHLiVBa0pdCZ76Vg2qeXcb-jgGMA4ci2y_ho3phKC3Jkc__lG8NMDAzKf0hgrk0pTRK8-qqCLzjw&udm=2&sa=X&ved=2ahUKEwi9o6XX7v6JAxUuVTABHYs4ElgQxKsJegQIDBAB&ictx=0"
    },
    ...
  ],
  "images": [
    {
      "position": 1,
      "title": "Fresh Gala Apple, Each",
      "source": {
        "name": "Walmart",
        "link": "https://www.walmart.com/ip/Fresh-Gala-Apple-Each/44390953"
      },
      "original": {
        "link": "https://i5.walmartimages.com/seo/Fresh-Gala-Apple-Each_f46d4fa7-6108-4450-a610-cc95a1ca28c5_3.38c2c5b2f003a0aafa618f3b4dc3cbbd.jpeg",
        "width": 3000,
        "height": 3000
      },
      "thumbnail": "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSjMsDnJRmRWZds5gdgxnLMYb8vuJfPpRUCzA&s"
    },
    ...
  ],
  "related_searches": [
    {
      "link": "https://www.google.com/search?sca_esv=4daba4fcecb7e45f&gl=us&udm=2&hl=en&q=apple+cartoon&stick=H4sIAAAAAAAAAFvEyptYUJCTqpCcWFSSn58HADkdrZwQAAAA&source=univ&sa=X&ved=2ahUKEwi9o6XX7v6JAxUuVTABHYs4ElgQrNwCegQIPRAA",
      "query": "apple cartoon",
      "highlighted": ["cartoon"]
    },
    ...
  ]
}
Images
Images
GET
Open url
https://www.searchapi.io/api/v1/search?api_key=Yo7Z933pdWGVYZssKMgQh7im&engine=google_images&q=panda
Request

Python

requests
import requests

url = "https://www.searchapi.io/api/v1/search"
params = {
  "engine": "google_images",
  "q": "panda",
  "api_key": "Yo7Z933pdWGVYZssKMgQh7im"
}

response = requests.get(url, params=params)
print(response.text)
Copy code
Response
{
  "images": [
    {
      "position": 1,
      "title": "Giant panda - Wikipedia",
      "source": {
        "name": "Wikipedia",
        "link": "https://en.wikipedia.org/wiki/Giant_panda"
      },
      "original": {
        "link": "https://upload.wikimedia.org/wikipedia/commons/thumb/0/0f/Grosser_Panda.JPG/640px-Grosser_Panda.JPG",
        "width": 640,
        "height": 427
      },
      "thumbnail": "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcTcizVg6CO7Hd_xCwzi3buwc7qVN6MnPUciSw&s"
    },
    ...
  ]
}
Suggestions
Suggestions
GET
Open url
https://www.searchapi.io/api/v1/search?api_key=Yo7Z933pdWGVYZssKMgQh7im&engine=google_images&q=Programming+languages
Request

Python

requests
import requests

url = "https://www.searchapi.io/api/v1/search"
params = {
  "engine": "google_images",
  "q": "Programming languages",
  "api_key": "Yo7Z933pdWGVYZssKMgQh7im"
}

response = requests.get(url, params=params)
print(response.text)
Copy code
Response
{
  "suggestions": [
    {
      "title": "Python",
      "link": "https://www.google.com/search?sca_esv=4daba4fcecb7e45f&gl=us&hl=en&q=python+Programming+languages&uds=ADvngMjcH0KdF7qGWtwTBrP0nt7dIqfV1NL4IPLO66CytgxdkuAvSgz7NyA-HyV-nltFo3OlVaEMigXPaRfu3sW9Oy5BBWG9oryPs8yVM3mFGQkfdFEjjlf_zSXPsgeH8NjmgwXYY5ZgNDtHZelOZyDAgFfsUZDax4Ikl4SXWbcnOAj8sp_F2oI&udm=2&sa=X&ved=2ahUKEwj71LKO8f6JAxWArYkEHeifGEcQxKsJegQIDBAB&ictx=0"
    },
    ...
  ],
  ...
}

## video search (google):

Google Videos API
GET
 
/api/v1/search?engine=google_videos
Download OpenAPI Spec

The Google Videos API offers a dynamic video search service. It accumulates video results from the most popular sources across the globe, categorizes similar videos, and presents them according to each user's search query. The API offers access to the specific source for each video, granting users the freedom to choose their preferred topic and select videos from various publishers.

API Parameters
Search Query
Name
q
Required
Required
Description
This parameter is used for the terms you want to search on Google Videos. Queries can include operators and advanced filters like "cooking tutorials", site:, inurl:, intitle:, as_dt, or as_eq.

Device
Name
device
Required
Optional
Description
The default parameter desktop defines the search on a desktop device. The mobile parameter defines the search on a mobile device. The tablet parameter defines the search on a tablet device.

Geographic Location
Name
location
Required
Optional
Description
This parameter is used to specify the canonical location of the search. For exact targeting or to see all available options, check out the Locations API. If multiple locations match your input, the most popular one will be selected.

Name
uule
Required
Optional
Description
This parameter sets the exact Google-encoded location for the search, and uule and location cannot be used at the same time. SearchApi builds it for you when you use the location parameter, but you can provide your own if you want precise control.

Localization
Name
google_domain
Deprecated
Deprecated
Required
Optional
Description
As of Apr 15, 2025, Google began phasing out country code top-level domains (ccTLDs). Users using the search bar or visiting local domains like google.de or google.co.uk are now automatically redirected to google.com. For localized searches, use the gl (country), hl (language) or other localization parameters instead. Learn more in Google's official announcement. See the full list of supported Google domains.

Name
gl
Required
Optional
Description
The default parameter us defines the country of the search. Check the full list of supported Google gl countries.

Name
hl
Required
Optional
Description
The default parameter en defines the interface language of the search. Check the full list of supported Google hl languages.

Name
lr
Required
Optional
Description
The lr parameter restricts search results to documents written in a particular language or a set of languages. The accepted format for this parameter is lang_{2-letter country code}. For instance, to filter documents written in Japanese, the value should be set to lang_jp. To incorporate multiple languages, a value like lang_it|lang_de restricts the search to documents written in either Italian or German. Google identifies the document language based on the top-level domain (TLD) of the document's URL, any language meta tags present, or the language utilized within the document's body text. Check the full list of supported Google lr languages.

Name
cr
Required
Optional
Description
The cr parameter restricts search results to documents originating in a particular country. Google determines the country of a document by the top-level domain (TLD) of the document's URL or by Web server's IP address geographic location. Check the full list of supported Google cr countries.

Filters
Name
nfpr
Required
Optional
Description
This parameter controls whether results from queries that have been auto-corrected for spelling errors are included. To exclude these auto-corrected results, set the value to 1. By default, the value is 0, meaning auto-corrected results are included.

Name
filter
Required
Optional
Description
This parameter controls whether the "Duplicate Content" and "Host Crowding" filters are enabled. Set the value to 1 to enable these filters, which is the default setting. To disable these filters, set the value to 0.

Name
safe
Required
Optional
Description
This parameter toggles the SafeSearch feature for the results. SafeSearch operates by filtering out adult content from your search results. Google's filters use proprietary technology to check keywords, phrases and URLs. While no filters are 100 percent accurate, SafeSearch will remove the overwhelming majority of adult content from your search results. Supported values are active to enable strict SafeSearch, blur to blur explicit images, and off to disable SafeSearch. By default, the value is blur.

Name
tbs
Required
Optional
Description
This parameter restricts results to URLs based on encoded values. For instance, dur:s would return only results that are shorter than 4 min.

Name
time_period
Required
Optional
Description
This parameter restricts results to URLs based on date. Supported values are:

last_hour - data from the past hour.
last_day - data from the past 24 hours.
last_week - data from the past week.
last_month - data from the past month.
last_year - data from the past year.
Note: this parameter is not compatible with a custom tbs parameter.
Name
duration
Required
Optional
Description
This parameter restricts results to URLs based on video duration. Supported values are:

short - short videos (0-4 min.).
medium - medium videos (4-20 min.).
long - long videos (20+ min.).
Note: this parameter is not compatible with a custom tbs parameter.
Name
quality
Required
Optional
Description
This parameter restricts results to URLs based on video quality. By default, all videos are returned. To retrieve only videos with high quality, high param should be used.
Note: this parameter is not compatible with a custom tbs parameter.

Name
captioned
Required
Optional
Description
This parameter restricts results to URLs based on video captions. By default, all videos are returned. To retrieve only videos with closed caption, closed param should be used.
Note: this parameter is not compatible with a custom tbs parameter.

Name
source
Required
Optional
Description
This parameter restricts results to URLs based on source. Supported values are: youtube, cncc, cnn, ted, cbsnews, twitter, tiktok, facebook, timesnownews, nbcnews, foxnews.
Note: this parameter is not compatible with a custom tbs parameter.

Pagination
Name
page
Required
Optional
Description
This parameter indicates which page of results to return. By default, it is set to 1.

Engine
Name
engine
Required
Required
Description
Parameter defines an engine that will be used to retrieve real-time data. It must be set to google_videos.

API key
Name
api_key
Required
Required
Description
The api_key authenticates your requests. Use it as a query parameter (https://www.searchapi.io/api/v1/search?api_key=YOUR_API_KEY) or in the Authorization header (Bearer YOUR_API_KEY).

Zero Data Retention
Name
zero_retention
Enterprise Only
Enterprise Only
Required
Optional
Description
Set this parameter to true to disable all logging and persistent storage. No request parameters, HTML, or JSON responses are stored or logged. Suitable for high-compliance use cases. Debugging and support may be limited while enabled.

API Examples
Full Response
Full Response
GET
Open url
https://www.searchapi.io/api/v1/search?api_key=Yo7Z933pdWGVYZssKMgQh7im&engine=google_videos&q=scraping+guides
Request

Python

requests
import requests

url = "https://www.searchapi.io/api/v1/search"
params = {
  "engine": "google_videos",
  "q": "scraping guides",
  "api_key": "Yo7Z933pdWGVYZssKMgQh7im"
}

response = requests.get(url, params=params)
print(response.text)
Copy code
Response
{
  "search_metadata": {
    "id": "search_OxE2l6wMgOJVSBbwp9PbYq4K",
    "status": "Success",
    "created_at": "2023-06-21T17:56:04Z",
    "request_time_taken": 1.35,
    "parsing_time_taken": 0.04,
    "total_time_taken": 1.39,
    "request_url": "https://www.google.com/search?q=Scraping+guides&oq=Scraping+guides&gl=us&hl=en&tbm=vid&ie=UTF-8",
    "html_url": "https://wwww.searchapi.io/api/v1/searches/search_OxE2l6wMgOJVSBbwp9PbYq4K.html",
    "json_url": "https://wwww.searchapi.io/api/v1/searches/search_OxE2l6wMgOJVSBbwp9PbYq4K"
  },
  "search_parameters": {
    "engine": "google",
    "q": "Scraping guides",
    "hl": "en",
    "gl": "us"
  },
  "search_information": {
    "query_displayed": "Scraping guides",
    "total_results": 5110000,
    "time_taken_displayed": 0.32
  },
  "videos": [
    ...
    {
      "position": 3,
      "title": "Beginners Guide To Web Scraping with Python - YouTube",
      "link": "https://www.youtube.com/watch?v=QhD015WUMxE",
      "displayed_link": "www.youtube.com › watch",
      "snippet": "The web is full of data. Lots and lots of data. Data prime for scraping. But manually going to a website and copying and pasting the data ...",
      "highlighted": [
        "scraping"
      ],
      "length": "7:36",
      "source": "YouTube",
      "date": "Nov 27, 2021",
      "channel": "Tinkernut",
      "key_moments": [
        {
          "time": "00:00",
          "seconds": 0,
          "title": "Introduction",
          "link": "https://www.youtube.com/watch?v=QhD015WUMxE&t=0",
          "thumbnail": "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcR4jPIu2ZKf7Qhi0lwiSscoljg9ruzc1Nn1Lcj3xYtNbQ&s"
        },
        ...
      ],
      "thumbnail": "data:image/jpeg;base64,..."
    },
    ...
  ],
  "related_searches": [
    {
      "query": "web scraping using python beautifulsoup",
      "link": "https://www.google.com/search?gl=us&hl=en&tbm=vid&q=Web+scraping+using+Python+BeautifulSoup&sa=X&ved=2ahUKEwiwxcja99T_AhW9kYkEHWFtBxsQ1QJ6BAgYEAE"
    },
    ...
  ]
}
Videos Carousel
Videos Carousel
GET
Open url
https://www.searchapi.io/api/v1/search?api_key=Yo7Z933pdWGVYZssKMgQh7im&device=mobile&engine=google_videos&q=How+to+scrape+websites
Request

Python

requests
import requests

url = "https://www.searchapi.io/api/v1/search"
params = {
  "engine": "google_videos",
  "q": "How to scrape websites",
  "device": "mobile",
  "api_key": "Yo7Z933pdWGVYZssKMgQh7im"
}

response = requests.get(url, params=params)
print(response.text)
Copy code
Response
{
  "videos_carousel": [
    {
      "position": 1,
      "title": "How to Easily Scrape Websites with Python and Beautiful Soup (Web Scraping with Python)",
      "snippet": "From 8:45 How to scrape a single page",
      "link": "https://www.youtube.com/watch?v=A1s1aGHoODs&t=525",
      "displayed_link": "YouTube • The PyCoach",
      "length": "23:13",
      "thumbnail": "data:image/jpeg;base64,..."
    },
    ...
  ]
}
Shorts Response
Shorts Response
GET
Open url
https://www.searchapi.io/api/v1/search?api_key=Yo7Z933pdWGVYZssKMgQh7im&device=mobile&engine=google_videos&q=Rami+Malek
Request

Python

requests
import requests

url = "https://www.searchapi.io/api/v1/search"
params = {
  "engine": "google_videos",
  "q": "Rami Malek",
  "device": "mobile",
  "api_key": "Yo7Z933pdWGVYZssKMgQh7im"
}

response = requests.get(url, params=params)
print(response.text)
Copy code
Response
{
  "shorts": [
    {
      "position": 1,
      "title": "Oscar Winner Rami Malek wins Best Actor | 91st Oscars",
      "link": "https://www.youtube.com/shorts/D3IbOSmUlf0",
      "source": "YouTube",
      "author": "Oscars",
      "thumbnail": "data:image/jpeg;base64,..."
    },
    ...
  ]
}