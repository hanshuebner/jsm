(in-package :cl-user)

(use-package :cxml)

(defmacro control (&rest keys &key &allow-other-keys)
  `(with-element "control"
     ,@(loop
          for (key value) on keys by #'cddr
          collect `(attribute ,(string-downcase key) ,value))))

;; screen resolution 768x984

(defun make-tetra-pages ()
  (with-xml-output (make-character-stream-sink *standard-output* :indentation 2)
    (with-element "layout"
      (attribute "version" 8)
      (attribute "mode" 1)
      (attribute "orientation" "vertical")
      (with-element "tabpage"
        (attribute "name" "sequencer")
        (dotimes (i 16)
          (let ((y (+ 25 (* i 61))))
            (control :name (format nil "seq-0-~D-rest" i)
                     :x 30
                     :y y
                     :w 20
                     :h 57
                     :scalef "0.0"
                     :scalet "1.0"
                     :color "gray"
                     :type "toggle"
                     :local_off "true")
            (control :name (format nil "seq-0-~D-reset" i)
                     :x 55
                     :y y
                     :w 20
                     :h 57
                     :scalef "0.0"
                     :scalet "1.0"
                     :color "red"
                     :type "toggle"
                     :local_off "true")
            (control :name (format nil "seq-0-~D" i)
                     :x 80
                     :y y
                     :w 150
                     :h 57
                     :color "orange"
                     :scalef "0.0"
                     :scalet "1.0"
                     :type "faderh"
                     :response "absolute"
                     :inverted "false"
                     :centered "false")
            (control :name (format nil "seq-1-~D-reset" i)
                     :x 300
                     :y y
                     :w 20
                     :h 57
                     :scalef "0.0"
                     :scalet "1.0"
                     :color "red"
                     :type "toggle"
                     :local_off "true")
            (control :name (format nil "seq-1-~D" i)
                     :x 330
                     :y y
                     :w 57
                     :h 57
                     :color "yellow"
                     :scalef "0.0"
                     :scalet "1.0"
                     :type "rotaryh"
                     :response "absolute"
                     :inverted "false"
                     :centered "false")
            (control :name (format nil "seq-2-~D-reset" i)
                     :x 440
                     :y y
                     :w 20
                     :h 57
                     :scalef "0.0"
                     :scalet "1.0"
                     :color "red"
                     :type "toggle"
                     :local_off "true")
            (control :name (format nil "seq-2-~D" i)
                     :x 470
                     :y y
                     :w 57
                     :h 57
                     :color "yellow"
                     :scalef "0.0"
                     :scalet "1.0"
                     :type "rotaryh"
                     :response "absolute"
                     :inverted "false"
                     :centered "false")
            (control :name (format nil "seq-3-~D-reset" i)
                     :x 580
                     :y y
                     :w 20
                     :h 57
                     :scalef "0.0"
                     :scalet "1.0"
                     :color "red"
                     :type "toggle"
                     :local_off "true")
            (control :name (format nil "seq-3-~D" i)
                     :x 610
                     :y y
                     :w 57
                     :h 57
                     :color "yellow"
                     :scalef "0.0"
                     :scalet "1.0"
                     :type "rotaryh"
                     :response "absolute"
                     :inverted "false"
                     :centered "false")))))))